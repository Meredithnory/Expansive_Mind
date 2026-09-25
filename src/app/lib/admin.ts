import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../api/authMiddleware";
import {
    configuredAdminEmails,
    isAdminIdentity,
} from "./admin-identity";
import { readAdminSessionFromRequest } from "./admin-session";

export function adminEmails() {
    return configuredAdminEmails();
}

export function isAdminUser(user?: { email?: string } | null) {
    return isAdminIdentity(user);
}

export async function hasAdminSession(
    request: NextRequest,
    userId?: string,
) {
    const session = await readAdminSessionFromRequest(request);
    if (!session) return false;
    if (userId && session.id !== userId) return false;
    return true;
}

export const withAdmin = (
    handler: (request: NextRequest) => Promise<NextResponse>,
) =>
    withAuth(async (request: NextRequest) => {
        const userId = request.user?._id?.toString();
        if (
            !userId ||
            !isAdminUser(request.user) ||
            !(await hasAdminSession(request, userId))
        ) {
            return NextResponse.json(
                { error: "Not authorized." },
                { status: 403 },
            );
        }
        try {
            return await handler(request);
        } catch (error) {
            console.error("Admin request failed", error);
            return NextResponse.json(
                { error: "Admin request failed." },
                { status: 500 },
            );
        }
    });
