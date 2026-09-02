import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../api/authMiddleware";
import {
    configuredAdminEmails,
    isAdminIdentity,
} from "./admin-identity";

export function adminEmails() {
    return configuredAdminEmails();
}

export function isAdminUser(user?: { email?: string } | null) {
    return isAdminIdentity(user);
}

export const withAdmin = (
    handler: (request: NextRequest) => Promise<NextResponse>,
) =>
    withAuth(async (request: NextRequest) => {
        if (!isAdminUser(request.user)) {
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
