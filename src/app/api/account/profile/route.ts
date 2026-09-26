import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import User from "../../../models/User";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import { parseProfileColor } from "../../../lib/profile-colors";

export const PATCH = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    const profileColor = parseProfileColor(body?.profileColor);
    if (!profileColor) {
        return NextResponse.json(
            { error: "Pick one of the profile colors." },
            { status: 400 },
        );
    }
    await User.updateOne({ _id: request.user._id }, { $set: { profileColor } });
    return NextResponse.json(
        { profileColor },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
