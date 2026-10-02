import "server-only";
import { after } from "next/server";
import connectDB from "../db/connectDB";
import LimitAlert from "../models/LimitAlert";
import User from "../models/User";
import { DEVELOPER_EMAIL } from "./contact";
import { isLimitAlertFeature, limitAlertEmail } from "./limit-alert-mail";
import { sendEmail } from "./send-email";

const KEEP_DAYS = 400;

export type LimitReached = {
    userID: string;
    feature: string;
    period: string;
    limit: number;
    used: number;
    /** They tried again after running out. */
    blocked: boolean;
};

function appOrigin() {
    return (process.env.APP_URL || "https://expansivemind.ai").replace(/\/+$/, "");
}

/**
 * Notes that a signed-in person used up a monthly allowance, after the
 * response goes out. The first time per person, feature, and month emails
 * Meredith; later hits only update the row /admin lists.
 */
export function scheduleLimitAlert(input: LimitReached) {
    if (!input.userID || !isLimitAlertFeature(input.feature) || input.period === "lifetime") {
        return;
    }
    const run = () => recordLimitAlert(input);
    try {
        after(run);
    } catch {
        // Outside a request (scripts): run it now, still without blocking.
        void run();
    }
}

export async function recordLimitAlert(input: LimitReached, now = new Date()) {
    if (!isLimitAlertFeature(input.feature)) return;
    try {
        await connectDB();
        const _id = `${input.userID}:${input.feature}:${input.period}`;
        const result = await LimitAlert.updateOne(
            { _id },
            {
                $setOnInsert: {
                    userID: input.userID,
                    feature: input.feature,
                    period: input.period,
                    firstAt: now,
                    expiresAt: new Date(now.getTime() + KEEP_DAYS * 24 * 60 * 60 * 1_000),
                },
                $set: {
                    limit: input.limit,
                    lastAt: now,
                    ...(input.blocked ? { blocked: true } : {}),
                },
                $max: { used: input.used },
            },
            { upsert: true },
        );
        if (!result.upsertedCount) return;

        const user = await User.findById(input.userID)
            .select("firstName lastName email")
            .lean<{ firstName?: string; lastName?: string; email?: string }>();
        if (!user?.email) return;
        const mail = limitAlertEmail({
            origin: appOrigin(),
            name: [user.firstName, user.lastName].filter(Boolean).join(" "),
            email: user.email,
            feature: input.feature,
            used: input.used,
            limit: input.limit,
            period: input.period,
        });
        const sent = await sendEmail({ to: DEVELOPER_EMAIL, replyTo: user.email, ...mail });
        if (sent.accepted) {
            await LimitAlert.updateOne({ _id }, { $set: { emailed: true } });
        }
    } catch (error) {
        // Two hits at once: the other one already made the row and the email.
        if ((error as { code?: number })?.code !== 11000) {
            console.error("Limit alert failed");
        }
    }
}
