import "server-only";
import OpenAI from "openai";
import { OPENROUTER_PROVIDER_POLICY } from "../lib/openrouter-policy";
import {
    recordUsage,
    type UsageContext,
} from "../lib/usage-meter";

const apiKey = process.env.AI_API_KEY;
const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

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

export async function createPrivateChatCompletion(
    request: Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, "stream">,
    usageContext?: UsageContext,
    options?: { timeoutMs?: number },
) {
    const payload = {
        ...request,
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
