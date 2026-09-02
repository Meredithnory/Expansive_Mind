import { NextResponse, NextRequest } from "next/server";
import User from "../../models/User";
import connectDB from "../../db/connectDB";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";
import jwt from "jsonwebtoken";

const maxAge = 24 * 60 * 60;

//POST Handler
export async function POST(request: NextRequest) {
    try {
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
        const firstName = formData.get("first_name") as string;
        const lastName = formData.get("last_name") as string;
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        //Validate required fields
        if (!email || !password) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Email and password are required",
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
            firstName: firstName?.trim(),
            lastName: lastName?.trim(),
            email: normalizedEmail,
            password: password.trim(),
        });

        //Save to MongoDB
        const savedSubmission = await newSubmission.save();

        //Return success response
        const token = jwt.sign(
            { id: savedSubmission._id.toString() },
            process.env.JWT_SECRET!,
            { expiresIn: maxAge },
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
