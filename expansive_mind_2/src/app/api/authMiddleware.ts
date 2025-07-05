import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import User from "../models/User";
import connectDB from "../db/connectDB";

const JWT_SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET!);

export const withAuth = (
    handler: (req: NextRequest) => Promise<NextResponse>
) => {
    return async (req: NextRequest): Promise<NextResponse> => {
        const token = req.cookies.get("auth_token")?.value;

        if (!token) {
            console.log("NO TOKEN FOUND");
            return NextResponse.json(
                { message: "You do not have access. Please login." },
                { status: 401 }
            );
        }

        try {
            // Verify the token using jose's jwtVerify
            const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

            const decodedToken = payload;

            await connectDB(); // Connect to DB

            let user = await User.findById(decodedToken.id);

            if (user) {
                req.user = user; // Attach user to the request
                return handler(req); // Call the original route handler
            } else {
                return NextResponse.json(
                    { message: "You do not have access. Please login." },
                    { status: 401 }
                );
            }
        } catch (err) {
            console.error("JWT Verification Error:", err);
            return NextResponse.json(
                { message: "You do not have access. Please login." },
                { status: 401 }
            );
        }
    };
};
