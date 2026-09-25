import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import User from "../models/User";
import connectDB from "../db/connectDB";
import { sessionVersionMatches } from "../lib/session-version";

const jwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is required.");
    }
    return new TextEncoder().encode(process.env.JWT_SECRET);
};

export async function attachAuthenticatedUser(req: NextRequest) {
    const token = req.cookies.get("auth_token")?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, jwtSecret(), {
        algorithms: ["HS256"],
    });
    if (typeof payload.id !== "string" || !payload.id) return null;
    await connectDB();
    const user = await User.findById(payload.id);
    if (!user) return null;
    if (!sessionVersionMatches(payload.tokenVersion, user.tokenVersion)) {
        return null;
    }
    req.user = user;
    return user;
}

export const withAuth = (
    handler: (req: NextRequest) => Promise<NextResponse>
) => {
    return async (req: NextRequest): Promise<NextResponse> => {
        try {
            const user = await attachAuthenticatedUser(req);
            if (!user) {
                return NextResponse.json(
                    { message: "You do not have access. Please login." },
                    { status: 401 }
                );
            }
        } catch {
            console.warn("Authentication failed");
            return NextResponse.json(
                { message: "You do not have access. Please login." },
                { status: 401 }
            );
        }
        return handler(req);
    };
};

export const withOptionalAuth = (
    handler: (req: NextRequest) => Promise<NextResponse>,
) => {
    return async (req: NextRequest): Promise<NextResponse> => {
        try {
            await attachAuthenticatedUser(req);
        } catch {
            req.user = undefined;
        }
        return handler(req);
    };
};
