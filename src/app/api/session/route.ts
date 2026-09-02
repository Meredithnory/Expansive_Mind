import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../authMiddleware";
import {
    getQuotaSnapshot,
    resolvePlan,
} from "../../lib/entitlements";
import { isAdminUser } from "../../lib/admin";

export const GET = withAuth(async (request: NextRequest) => {
    const userID = request.user._id.toString();
    const plan = resolvePlan(request.user);
    const isAdmin = isAdminUser(request.user);
    const quotas = await getQuotaSnapshot({
        plan,
        identity: userID,
        userID,
        unlimited: isAdmin,
    });
    return NextResponse.json(
        {
            authenticated: true,
            user: {
                id: request.user._id,
                firstName: request.user.firstName,
                lastName: request.user.lastName,
                email: request.user.email,
                plan,
                isAdmin,
                subscriptionStatus: request.user.subscriptionStatus || "none",
            },
            quotas,
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
