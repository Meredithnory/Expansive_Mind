// app/api/aichat/route.ts
import { NextResponse } from "next/server";
import { respondToMessage } from "../general-chat";

// This function handles POST requests to /api/aichat
export async function POST(request: Request) {
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
}
