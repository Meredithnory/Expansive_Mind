import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(request: NextRequest) {
    const token = request.cookies.get("auth_token")?.value;
    const { pathname } = request.nextUrl;

    // Define protected routes
    const protectedRoutes = [
        "/savedpapers",
        "/get-started",
        "/searchpaper",
        "/paperchatbot",
    ];

    // Define public routes that logged-in users shouldn't access
    const authRoutes = ["/login", "/signup"];

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
            await jwtVerify(token, secret);
            return true;
        } catch (error) {
            console.error("Token verification failed:", error);
            return false;
        }
    };

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
    const isValidToken = await verifyToken(token);

    if (!isValidToken) {
        // Invalid token - clear it and redirect to login
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("auth_token");
        return response;
    }

    // Valid token cases
    if (isAuthRoute) {
        // Logged-in user trying to access login/signup - redirect to dashboard
        return NextResponse.redirect(new URL("/get-started", request.url));
    }

    // Allow access to protected routes and other pages
    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
