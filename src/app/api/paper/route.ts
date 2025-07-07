import { NextResponse, NextRequest } from "next/server";
import { getPaperDetails } from "./utils";
import { withAuth } from "../authMiddleware";
import SavedPaper from "../../models/SavedPaper";
import Message from "../../models/Message";
import mongoose from "mongoose";

export const GET = withAuth(async (request: NextRequest) => {
    try {
        const pmcid = request.nextUrl.searchParams.get("pmcid");
        if (!pmcid) {
            throw Error("Invalid PMCID.");
        }
        const paper = await getPaperDetails(pmcid);
        interface MessageInterface {
            id: string;
            sender: string;
            message: string;
            timestamp: Date;
        }
        let messages: MessageInterface[] = [];
        const foundPaper = await SavedPaper.findOne({
            pmcid: pmcid,
            userID: request.user._id,
        });

        if (foundPaper) {
            const allMessages = await Message.find({
                savedPaperID: foundPaper._id,
            }).sort({
                createdAt: 1,
            });
            messages = allMessages.map((message) => ({
                id: message._id,
                sender: message.sender,
                message: message.message,
                timestamp: message.createdAt,
            }));
        }
        return NextResponse.json({ paper, messages }); // return the paper as the key paper
    } catch (err: any) {
        console.error("Error in API req handler", err.message);
        return NextResponse.json(
            { error: err.message || "An internal server error occured." },
            { status: 500 }
        );
    }
});
