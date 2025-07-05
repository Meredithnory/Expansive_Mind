// app/api/aichat/route.ts
import { NextResponse, NextRequest } from "next/server";
import { respondToMessage } from "../general-chat";
import { withAuth } from "../authMiddleware";

// This function handles POST requests to /api/aichat
export const POST = withAuth(async (request: NextRequest) => {
    const data = await request.json();
    const messageForAI = data.userResponse;
    const wholePaper = data.wholePaper;
    const allMessages = data.allMessages;
    console.log(messageForAI); //Send to AI bot
    const message = await respondToMessage(
        messageForAI,
        wholePaper,
        allMessages
    );
    const aiResponse = { id: 1, sender: "ai", message: message, timestamp: "" };

    return NextResponse.json({ aiResponse }, { status: 200 });
});
