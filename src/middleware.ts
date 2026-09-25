import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import {
    ADMIN_SESSION_COOKIE,
    readAdminSession,
} from "./app/lib/admin-session";

export async function middleware(request: NextRequest) {
    const token = request.cookies.get("auth_token")?.value;
    const { pathname } = request.nextUrl;

    // Define protected routes (admin login is public; other /admin needs admin_session)
    const protectedRoutes = [
        "/savedpapers",
        "/projects",
    ];

    // Define public routes that logged-in users shouldn't access
    const authRoutes = ["/login", "/signup"];

    const isAdminLogin =
        pathname === "/admin/login" || pathname.startsWith("/admin/login/");
    const isAdminDashboard =
        pathname.startsWith("/admin") && !isAdminLogin;

    const isProtectedRoute = protectedRoutes.some((route) =>
        pathname.startsWith(route)
    );

    const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

    // Helper function to verify token
    const verifyToken = async (token: string) => {
        try {
            if (!process.env.JWT_SECRET) {
                throw new Error("No JWT SECRET");
            }
            const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
            const { payload } = await jwtVerify(token, secret, {
                algorithms: ["HS256"],
            });
            return payload;
        } catch {
            console.error("Token verification failed");
            return null;
        }
    };

    // Admin dashboard: require a valid admin_session cookie (set only by admin login).
    // Do not gate on auth JWT email — createAuthSessionToken only signs { id }.
    if (isAdminDashboard) {
        const adminSession = await readAdminSession(
            request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
        );
        if (!adminSession) {
            // no-store: the client router must not reuse this logged-out
            // redirect after admin_session is set, or the authenticator step
            // stays mounted and the next code submit looks like a password error.
            const response = NextResponse.redirect(
                new URL("/admin/login", request.url),
            );
            response.headers.set("Cache-Control", "private, no-store");
            return response;
        }
        return NextResponse.next();
    }

    // /admin/login is reachable without auth_token
    if (isAdminLogin) {
        return NextResponse.next();
    }

    // No token cases
    if (!token) {
        // Redirect to login if trying to access protected route
        if (isProtectedRoute) {
            return NextResponse.redirect(new URL("/login", request.url));
        }
        // Allow access to public routes
        return NextResponse.next();
    }

    // Token exists - verify it
    const tokenPayload = await verifyToken(token);

    if (!tokenPayload) {
        // Invalid token - clear it and redirect to login
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("auth_token");
        return response;
    }

    // Valid token cases
    if (isAuthRoute) {
        // Logged-in users return to the product's discovery-first home.
        return NextResponse.redirect(new URL("/discover", request.url));
    }

    // Allow access to protected routes and other pages
    return NextResponse.next();
}

export const config = {
    matcher: [
        "/savedpapers/:path*",
        "/projects/:path*",
        "/admin/:path*",
        "/login",
        "/signup",
    ],
};
