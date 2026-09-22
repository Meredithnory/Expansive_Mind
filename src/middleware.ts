import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import {
    ADMIN_SESSION_COOKIE,
    readAdminSession,
} from "./app/lib/admin-session";

function jwtSecret() {
    if (!process.env.JWT_SECRET) {
        throw new Error("No JWT SECRET");
    }
    return new TextEncoder().encode(process.env.JWT_SECRET);
}

async function hasValidAuthToken(token?: string) {
    if (!token) return false;
    try {
        await jwtVerify(token, jwtSecret());
        return true;
    } catch (error) {
        console.error("Token verification failed:", error);
        return false;
    }
}

async function hasValidAdminSession(token?: string, authUserId?: string) {
    const session = await readAdminSession(token);
    if (!session) return false;
    if (authUserId && session.id !== authUserId) return false;
    return true;
}

async function authUserId(token?: string) {
    if (!token) return undefined;
    try {
        const { payload } = await jwtVerify(token, jwtSecret());
        return typeof payload.id === "string" ? payload.id : undefined;
    } catch {
        return undefined;
    }
}

export async function middleware(request: NextRequest) {
    const token = request.cookies.get("auth_token")?.value;
    const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const { pathname } = request.nextUrl;

    const protectedRoutes = ["/savedpapers", "/projects"];
    const adminLoginPath = "/admin/login";
    const isAdminLogin = pathname === adminLoginPath;
    const isAdminRoute =
        pathname === "/admin" || pathname.startsWith("/admin/");
    const isProtectedRoute = protectedRoutes.some((route) =>
        pathname.startsWith(route),
    );
    const authRoutes = ["/login", "/signup"];
    const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

    if (!token) {
        if (isAdminLogin) return NextResponse.next();
        if (isAdminRoute) {
            return NextResponse.redirect(new URL(adminLoginPath, request.url));
        }
        if (isProtectedRoute) {
            return NextResponse.redirect(new URL("/login", request.url));
        }
        return NextResponse.next();
    }

    const isValidToken = await hasValidAuthToken(token);

    if (!isValidToken) {
        const response = isAdminRoute
            ? NextResponse.redirect(new URL(adminLoginPath, request.url))
            : NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("auth_token");
        response.cookies.delete(ADMIN_SESSION_COOKIE);
        return response;
    }

    if (isAuthRoute) {
        return NextResponse.redirect(new URL("/discover", request.url));
    }

    if (isAdminLogin) {
        const userId = await authUserId(token);
        if (await hasValidAdminSession(adminToken, userId)) {
            return NextResponse.redirect(new URL("/admin", request.url));
        }
        return NextResponse.next();
    }

    if (isAdminRoute) {
        const userId = await authUserId(token);
        if (!(await hasValidAdminSession(adminToken, userId))) {
            const response = NextResponse.redirect(
                new URL(adminLoginPath, request.url),
            );
            if (adminToken) response.cookies.delete(ADMIN_SESSION_COOKIE);
            return response;
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/savedpapers/:path*",
        "/projects/:path*",
        "/admin",
        "/admin/:path*",
        "/login",
        "/signup",
    ],
};
