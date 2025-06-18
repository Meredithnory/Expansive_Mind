// app/api/aichat/route.ts
import { NextResponse } from 'next/server';

// This function handles POST requests to /api/aichat
export async function POST(request: Request) {
  const data = await request.json()
  const messageForAI = data.userResponse
  console.log(messageForAI) //Send to AI bot 

  const aiResponse = {id:1, sender: "ai", message: "How can I help you", timestamp: ""}

  return NextResponse.json({aiResponse}, {status: 200})
}
