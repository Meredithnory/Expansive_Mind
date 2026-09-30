import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "../../../lib/admin";
import { recordAdminAction } from "../../../lib/admin-audit";
import {
    hasValidMutationOrigin,
    readLimitedJsonBody,
} from "../../../lib/request-security";
import ContactMessage from "../../../models/ContactMessage";
import ForumReport from "../../../models/ForumReport";

/** Contact-page messages, newest first, plus how many forum reports wait. */
export const GET = withAdmin(async (request: NextRequest) => {
    const status = request.nextUrl.searchParams.get("status");
    const filter = status === "new" || status === "done" ? { status } : {};
    const [messages, newCount, openReports] = await Promise.all([
        ContactMessage.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
        ContactMessage.countDocuments({ status: "new" }),
        ForumReport.countDocuments({ resolved: false }),
    ]);
    return NextResponse.json(
        { messages, newCount, openReports },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});

/** Mark a message done, or back to new. */
export const PATCH = withAdmin(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    const parsed = await readLimitedJsonBody(request, 1_024);
    const body = parsed.ok ? (parsed.value as Record<string, unknown>) : {};
    const id = String(body.id || "");
    const status = body.status;
    if (!mongoose.isValidObjectId(id) || (status !== "new" && status !== "done")) {
        return NextResponse.json({ error: "A message and a status are required." }, { status: 400 });
    }
    const updated = await ContactMessage.findByIdAndUpdate(id, { $set: { status } }, { new: true }).lean();
    if (!updated) return NextResponse.json({ error: "Message not found." }, { status: 404 });
    await recordAdminAction({
        adminEmail: request.user.email,
        action: `feedback.${status}`,
        target: `contact:${id}`,
    });
    return NextResponse.json({ ok: true });
});
