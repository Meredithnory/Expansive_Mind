import "server-only";
import { AI_SECURITY_POLICY } from "../lib/ai-security";
import OpenAI from "openai";
import { OPENROUTER_PROVIDER_POLICY } from "../lib/openrouter-policy";
import {
    recordUsage,
    type UsageContext,
} from "../lib/usage-meter";

const apiKey = process.env.AI_API_KEY;
const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
const MAX_OUTPUT_TOKENS = 5_000;
const MAX_TEXT_PROMPT_CHARACTERS = 120_000;
const MAX_MESSAGES = 32;
const MAX_EMBEDDING_INPUTS = 32;
const MAX_EMBEDDING_CHARACTERS = 32_000;

const client = apiKey
    ? new OpenAI({
          baseURL: "https://openrouter.ai/api/v1",
          apiKey,
          maxRetries: 0,
          timeout: 12_000,
          defaultHeaders: {
              ...(appUrl ? { "HTTP-Referer": appUrl } : {}),
              "X-OpenRouter-Title": "Expansive Mind",
          },
      })
    : null;

function requireClient() {
    if (!client) {
        throw new Error("AI service is not configured.");
    }
    return client;
}

function textCharacters(
    messages: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming["messages"],
) {
    return messages.reduce((total, message) => {
        if (typeof message.content === "string") {
            return total + message.content.length;
        }
        if (!Array.isArray(message.content)) return total;
        return (
            total +
            message.content.reduce(
                (subtotal, part) =>
                    subtotal +
                    (part.type === "text" ? part.text.length : 0),
                0,
            )
        );
    }, 0);
}

export async function createPrivateChatCompletion(
    request: Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, "stream">,
    usageContext?: UsageContext,
    options?: { timeoutMs?: number },
) {
    if (request.tools?.length || request.functions?.length) {
        throw new Error("Model tool execution is not enabled for this application.");
    }
    if (
        request.messages.length > MAX_MESSAGES ||
        textCharacters(request.messages) > MAX_TEXT_PROMPT_CHARACTERS
    ) {
        throw new Error("AI prompt exceeds the configured safety limit.");
    }
    const payload = {
        ...request,
        messages: [{ role: "system", content: AI_SECURITY_POLICY }, ...request.messages],
        max_tokens: Math.min(
            request.max_tokens ?? 1_000,
            MAX_OUTPUT_TOKENS,
        ),
        stream: false,
        provider: OPENROUTER_PROVIDER_POLICY,
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & {
        provider: typeof OPENROUTER_PROVIDER_POLICY;
    };

    try {
        const response = await requireClient().chat.completions.create(
            payload,
            options?.timeoutMs ? { timeout: options.timeoutMs } : undefined,
        );
        if (usageContext) {
            await recordUsage({
                context: usageContext,
                provider: "openrouter",
                operation: "chat_completion",
                model: request.model,
                inputTokens: response.usage?.prompt_tokens,
                outputTokens: response.usage?.completion_tokens,
            });
        }
        return response;
    } catch (error) {
        if (usageContext) {
            await recordUsage({
                context: usageContext,
                provider: "openrouter",
                operation: "chat_completion",
                model: request.model,
                success: false,
            });
        }
        throw error;
    }
}

export async function createPrivateEmbedding(request: {
    model: string;
    input: string[];
}, usageContext?: UsageContext) {
    const embeddingCharacters = request.input.reduce(
        (total, value) => total + value.length,
        0,
    );
    if (
        request.input.length === 0 ||
        request.input.length > MAX_EMBEDDING_INPUTS ||
        embeddingCharacters > MAX_EMBEDDING_CHARACTERS
    ) {
        throw new Error("Embedding input exceeds the configured safety limit.");
    }
    const payload = {
        ...request,
        provider: OPENROUTER_PROVIDER_POLICY,
    } as OpenAI.Embeddings.EmbeddingCreateParams & {
        provider: typeof OPENROUTER_PROVIDER_POLICY;
    };

    try {
        const response = await requireClient().embeddings.create(payload);
        if (usageContext) {
            await recordUsage({
                context: usageContext,
                provider: "openrouter",
                operation: "embedding",
                model: request.model,
                inputTokens: response.usage?.prompt_tokens,
            });
        }
        return response;
    } catch (error) {
        if (usageContext) {
            await recordUsage({
                context: usageContext,
                provider: "openrouter",
                operation: "embedding",
                model: request.model,
                success: false,
            });
        }
        throw error;
    }
}

const TRANSCRIBE_MODEL =
    process.env.TRANSCRIBE_MODEL || "openai/whisper-large-v3";

export async function createPrivateTranscription(
    input: {
        audioBase64: string;
        format: string;
        language?: string;
    },
    usageContext?: UsageContext,
) {
    if (!apiKey) {
        throw new Error("AI service is not configured.");
    }

    try {
        const response = await fetch(
            "https://openrouter.ai/api/v1/audio/transcriptions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "X-OpenRouter-Title": "Expansive Mind",
                    ...(appUrl ? { "HTTP-Referer": appUrl } : {}),
                },
                body: JSON.stringify({
                    model: TRANSCRIBE_MODEL,
                    language: input.language,
                    input_audio: {
                        data: input.audioBase64,
                        format: input.format,
                    },
                    provider: OPENROUTER_PROVIDER_POLICY,
                }),
                signal: AbortSignal.timeout(20_000),
            },
        );
        const data = (await response.json().catch(() => ({}))) as {
            text?: string;
            error?: { message?: string };
            usage?: {
                input_tokens?: number;
                output_tokens?: number;
                cost?: number;
                seconds?: number;
            };
        };
        if (!response.ok || typeof data.text !== "string") {
            throw new Error(
                data.error?.message || "Voice transcription failed.",
            );
        }
        if (usageContext) {
            await recordUsage({
                context: usageContext,
                provider: "openrouter",
                operation: "transcription",
                model: TRANSCRIBE_MODEL,
                inputTokens: data.usage?.input_tokens,
                outputTokens: data.usage?.output_tokens,
                estimatedCostMicros:
                    typeof data.usage?.cost === "number"
                        ? Math.round(data.usage.cost * 1_000_000)
                        : undefined,
                metadata: { seconds: data.usage?.seconds },
            });
        }
        return data.text;
    } catch (error) {
        if (usageContext) {
            await recordUsage({
                context: usageContext,
                provider: "openrouter",
                operation: "transcription",
                model: TRANSCRIBE_MODEL,
                success: false,
            });
        }
        throw error;
    }
}
