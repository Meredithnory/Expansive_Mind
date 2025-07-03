import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
const jwt = require("jsonwebtoken");

//Middleware protecting pages
export async function middleware(request: NextRequest) {
    const token = request.cookies.get("jwt")?.value;
    const { pathname } = request.nextUrl;

    // Define protected routes (pages, not API routes)
    const protectedRoutes = ["/savedpapers"];
    console.log("here");

    // Check if current path is protected
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
            jwt.verify(token, process.env.JWT_SECRET!);
            // Token is valid, allow access
            return NextResponse.next();
        } catch (error) {
            // Token is invalid, redirect to login
            const response = NextResponse.redirect(
                new URL("/login", request.url)
            );
            response.cookies.delete("jwt");
            return response;
        }
    }

    return NextResponse.next();
}
//"Run this middleware for all incoming requests EXCEPT for those that start with: /api ...."
export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
