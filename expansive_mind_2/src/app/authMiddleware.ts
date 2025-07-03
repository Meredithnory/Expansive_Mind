const jwt = require("jsonwebtoken");
import { NextApiRequest, NextApiResponse } from "next";
import User from "./models/User";
import connectDB from "./db/connectDB";

//Authmiddleware for protecting API endpoints

interface AuthenticatedRequest extends NextApiRequest {
    user?: any;
}

type AuthMiddleware = (
    req: AuthenticatedRequest,
    res: NextApiResponse,
    next: () => void
) => void;

// Check current user
const checkUser: AuthMiddleware = (req, res, next) => {
    // Get token from request then from cookies then from token
    const token = req.cookies.jwt;

    if (token) {
        jwt.verify(
            token,
            process.env.JWT_SECRET!,
            async (err: any, decodedToken: any) => {
                if (err) {
                    //Error
                    res.status(401).json({
                        message: "You do not have access. Please login.",
                    });
                } else {
                    try {
                        // Connect to DB
                        await connectDB();

                        // Query for the user who made the req in the db
                        let user = await User.findById(decodedToken.id);

                        if (user) {
                            // Object of the user's information stored in 'user'
                            // Using req.user instead of res.locals.user for Next.js
                            req.user = user;
                            next();
                        } else {
                            res.status(401).json({
                                message:
                                    "You do not have access. Please login.",
                            });
                        }
                    } catch (error) {
                        res.status(401).json({
                            message: "You do not have access. Please login.",
                        });
                    }
                }
            }
        );
    } else {
        // Set to null if no token has been issued and no access to the user's info
        res.status(401).json({
            message: "You do not have access. Please login.",
        });
    }
};

// Helper function to wrap API routes with middleware
export const withAuth = (
    handler: (req: AuthenticatedRequest, res: NextApiResponse) => void
) => {
    //returns a new function that takes a req and res params
    //third param is next() bc we have no express
    return (req: AuthenticatedRequest, res: NextApiResponse) => {
        checkUser(req, res, () => {
            handler(req, res);
        });
    };
};

export default checkUser;
