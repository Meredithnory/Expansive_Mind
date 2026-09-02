import { NextResponse, NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../../models/User";
import connectDB from "../../db/connectDB";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";

const maxAge = 24 * 60 * 60;

//Defining a function to create token - encrypting the token with the secret
const createToken = (id: string) => {
    return jwt.sign({ id }, process.env.JWT_SECRET!, {
        expiresIn: 24 * 60 * 60, //JWT in seconds
    });
};

export async function POST(request: NextRequest) {
    try {
        const rateLimit = await consumeRateLimit({
            scope: "login",
            identity: requestIp(request),
            limit: 5,
            windowMs: 15 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Too many login attempts. Try again later.",
                },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }
        // Connect to MongoDB
        await connectDB();

        // Parse JSON from the request
        const { email, password } = await request.json();

        // Validate required fields
        if (!email || !password) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Email and password are required",
                },
                { status: 400 }
            );
        }

        // Find user by email
        const user = await User.findOne({
            email: email.trim().toLowerCase(),
        });
        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid email or password",
                },
                { status: 400 }
            );
        }
        // Compare password with hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid email or password",
                },
                { status: 400 }
            );
        }

        // Create token
        const token = createToken(user._id.toString());

        // Create response
        const response = NextResponse.json({
            success: true,
            message: "Login successful",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
            },
        });
        // Setting the HTTP-only cookie - must be stored in milisecconds
        response.cookies.set("auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: maxAge,
            path: "/",
        });
        return response;
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}
