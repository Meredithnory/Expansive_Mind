import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import User from "../../../models/User";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import { parseProfileColor } from "../../../lib/profile-colors";
import { cleanBio, parseBadgePatch } from "../../../lib/lab-badge";

// Saves any of: profileColor (the coat), badge fields, bio, productEmailOptIn. Only the keys
// sent are written; every value is validated first.
export const PATCH = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "A valid update is required." }, { status: 400 });
    }

    const set: Record<string, unknown> = {};
    if ("profileColor" in body) {
        const profileColor = parseProfileColor(body.profileColor);
        if (!profileColor) {
            return NextResponse.json(
                { error: "Pick one of the coat colors." },
                { status: 400 },
            );
        }
        set.profileColor = profileColor;
    }
    if ("badge" in body) {
        const parsed = parseBadgePatch(body.badge);
        if ("error" in parsed) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        for (const [key, value] of Object.entries(parsed.patch)) {
            set[`badge.${key}`] = value;
        }
    }
    if ("bio" in body) {
        const bio = cleanBio(body.bio);
        if (bio === null) {
            return NextResponse.json({ error: "Bio must be text." }, { status: 400 });
        }
        set.bio = bio;
    }
    if ("productEmailOptIn" in body) {
        if (typeof body.productEmailOptIn !== "boolean") {
            return NextResponse.json({ error: "Choose on or off." }, { status: 400 });
        }
        set.productEmailOptIn = body.productEmailOptIn;
        // Keep a consent record: when it was turned on and where, or when off.
        if (body.productEmailOptIn) {
            set.productEmailOptInAt = new Date();
            set.productEmailOptInSource = "profile";
        } else {
            set.productEmailOptOutAt = new Date();
        }
    }
    if (Object.keys(set).length === 0) {
        return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    await User.updateOne({ _id: request.user._id }, { $set: set }, { runValidators: true });
    return NextResponse.json(
        { saved: set },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
