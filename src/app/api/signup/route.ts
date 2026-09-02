import { NextResponse, NextRequest } from "next/server";
import User from "../../models/User";
import connectDB from "../../db/connectDB";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";
import jwt from "jsonwebtoken";
import {
    hasAcceptableContentLength,
    hasValidMutationOrigin,
} from "../../lib/request-security";

const maxAge = 24 * 60 * 60;

//POST Handler
export async function POST(request: NextRequest) {
    try {
        if (!hasValidMutationOrigin(request)) {
            return NextResponse.json(
                { success: false, error: "Invalid origin." },
                { status: 403 },
            );
        }
        if (!hasAcceptableContentLength(request, 32 * 1024)) {
            return NextResponse.json(
                { success: false, error: "Signup request is too large." },
                { status: 413 },
            );
        }
        const rateLimit = await consumeRateLimit({
            scope: "signup",
            identity: requestIp(request),
            limit: 3,
            windowMs: 60 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Too many signup attempts. Try again later.",
                },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }
        //Connect to MongoDB
        await connectDB();

        //Parse FormData from the request
        const formData = await request.formData();

        //Extract fields from FormData
        const firstName = formData.get("first_name");
        const lastName = formData.get("last_name");
        const email = formData.get("email");
        const password = formData.get("password");

        //Validate required fields
        if (
            typeof firstName !== "string" ||
            typeof lastName !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !firstName.trim() ||
            !lastName.trim() ||
            !email.trim() ||
            !password.trim() ||
            firstName.length > 100 ||
            lastName.length > 100 ||
            email.length > 254 ||
            password.length > 128
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Please check your name, email, and password.",
                },
                { status: 400 }
            );
        }

        //Check if user with this email already exists
        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Email already registered.",
                },
                { status: 409 }
            );
        }

        //Create new document using the MODEL(User)
        const newSubmission = new User({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: normalizedEmail,
            password: password.trim(),
        });

        //Save to MongoDB
        const savedSubmission = await newSubmission.save();

        //Return success response
        const token = jwt.sign(
            { id: savedSubmission._id.toString() },
            process.env.JWT_SECRET!,
            { algorithm: "HS256", expiresIn: maxAge },
        );
        const response = NextResponse.json(
            {
                success: true,
                message: "Form submitted successfully",
                data: {
                    id: savedSubmission._id,
                    firstName: savedSubmission.firstName,
                    lastName: savedSubmission.lastName,
                    email: savedSubmission.email,
                    submittedAt: savedSubmission.submittedAt,
                },
            },
            { status: 200 }
        );
        response.cookies.set("auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge,
            path: "/",
        });
        return response;
    } catch (error) {
        console.error("Error processing form submission", error);
        return NextResponse.json(
            {
                success: false,
                error: "Internal server error",
            },
            { status: 500 }
        );
    }
}
