import OpenAI from "openai";
import { FormattedPaper } from "./general-interfaces";

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.AI_API_KEY,
});

function formatPaper(paperSections) {
    return paperSections
        .map((sec) => `## ${sec.title}\n${sec.content.trim()}`)
        .join("\n\n");
}

export async function respondToMessage(
    message: string,
    wholePaper: FormattedPaper,
    chatHistory: string[]
): Promise<string | null> {
    const systemPrompt = `
    You are NIH Research Paper Bot—a friendly, professional assistant.
    Use ONLY the provided paper as your source of truth.
    • You MAY draw on the Abstract, Web-summary, Introduction, Results,
      Discussion, figures or tables.
    • Answer only questions directly supported by the paper.
    • Cite the section you used in parentheses. E.g.: (Abstract) or 
      (Web-summary).
    • If the paper does NOT contain the answer, reply exactly:
      “I'm sorry, but that question cannot be answered 
       based on the provided paper.”
    • Make it like a conversational talk about the findings as if you two were in a research paper bookclub.
    • Always ask the user if they want a follow up question or questions on the paper itself or amy key words theat might seem unfamilar to them.
      `.trim();

    const paperText = formatPaper(wholePaper.paper);
    // e.g. "## Abstract\nThe ureter is …\n\n## Introduction\n…"
    const paperMessage = {
        role: "user",
        content: `Here is the paper:\n\n${paperText}`,
    };

    // 3) turn chatHistory into valid messages
    const historyMessages = chatHistory.map((h) => ({
        role: h.sender === "user" ? "user" : "assistant",
        content: h.message,
    }));

    // 4) new user question
    const userMessage = {
        role: "user",
        content: message,
    };

    // assemble
    const messages = [
        { role: "system", content: systemPrompt },
        paperMessage,
        ...historyMessages,
        userMessage,
    ];

    const completion = await openai.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages,
    });

    return completion.choices[0].message.content;
}
