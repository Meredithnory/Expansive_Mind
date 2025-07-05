import { NextResponse, NextRequest } from "next/server";
import User from "../../models/User";
import connectDB from "../../db/connectDB";

//POST Handler
export async function POST(request: NextRequest) {
    try {
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
        const existingUser = await User.findOne({ email: email });
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
            email: email.trim(),
            password: password.trim(),
        });

        //Save to MongoDB
        const savedSubmission = await newSubmission.save();

        //Return success response
        return NextResponse.json(
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
