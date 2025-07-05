import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

//Middleware protecting pages
export async function middleware(request: NextRequest) {
    const token = request.cookies.get("auth_token")?.value;
    const { pathname } = request.nextUrl;
    // Define protected routes (pages, not API routes)
    const protectedRoutes = [
        "/savedpapers",
        "/get-started",
        "/searchpaper",
        "/paperchatbot",
    ];

    const isProtectedRoute = protectedRoutes.some((route) =>
        pathname.startsWith(route)
    );

    // If trying to access protected route without token
    if (isProtectedRoute && !token) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // If token exists, verify it
    if (token && isProtectedRoute) {
        try {
            if (!process.env.JWT_SECRET) {
                throw new Error("No JWT SECRET");
            }
            //Using the JWT_SECRET to decrypt the token
            const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
            //Using the key to unlock to payload
            //key is secret
            //Lock is token
            jwtVerify(token, secret);
            // Token is valid, allow access
            return NextResponse.next();
        } catch (error) {
            // Token is invalid, redirect to login
            const response = NextResponse.redirect(
                new URL("/login", request.url)
            );
            console.error(error);
            response.cookies.delete("auth_token");
            return response;
        }
    }

    return NextResponse.next();
}
//"Run this middleware for all incoming requests EXCEPT for those that start with: /api ...."
export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
