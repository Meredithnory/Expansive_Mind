// app/api/aichat/route.ts
import { NextResponse, NextRequest } from "next/server";
import { respondToMessage } from "../general-chat";
import { withAuth } from "../authMiddleware";
import SavedPaper from "../../models/SavedPaper";
import Message from "../../models/Message";

// This function handles POST requests to /api/aichat
export const POST = withAuth(async (request: NextRequest) => {
    const data = await request.json();
    const messageForAI = data.userResponse;
    const wholePaper = data.wholePaper;
    const allMessages = data.allMessages;
    const userID = request.user._id;

    ////////////////////////////////////////////////
    //If paper does not exist then return an error
    if (!wholePaper || !wholePaper.pmcid) {
        return NextResponse.json(
            { error: "wholePaper with pmcid is required" },
            { status: 500 }
        );
    }
    /////////////////////////////////////////////////
    //Find paper to make only one saved paper per user
    let foundOrCreatedPaper = await SavedPaper.findOne({
        pmcid: wholePaper.pmcid,
        userID: userID,
    });
    if (!foundOrCreatedPaper) {
        //Create SavedPaper document using the MODEL(SavedPaper)
        const savedPaper = new SavedPaper({
            pmcid: wholePaper.pmcid,
            userID: userID,
        });
        //Save to MongoDB
        foundOrCreatedPaper = await savedPaper.save();
    }
    //////////////////////////////////////////////////

    //Create user Message document using the MODEL(Message)
    const userMessage = new Message({
        savedPaperID: foundOrCreatedPaper._id,
        sender: "user",
        message: messageForAI,
    });
    //Save to MongoDB
    const savedUserMessage = await userMessage.save();
    //////////////////////////////////////////////////

    const messageBackFromAI = await respondToMessage(
        messageForAI,
        wholePaper,
        allMessages
    );

    //Create ai Message document using the MODEL(Message)
    const aiMessage = new Message({
        savedPaperID: foundOrCreatedPaper._id,
        sender: "ai",
        message: messageBackFromAI,
    });
    //Save to MongoDB
    const savedAiMessage = await aiMessage.save();

    // Formatted for Client
    const aiResponse = {
        id: savedAiMessage._id,
        sender: "ai",
        message: savedAiMessage.message,
        timestamp: savedAiMessage.createdAt,
    };

    return NextResponse.json({ aiResponse }, { status: 200 });
});
