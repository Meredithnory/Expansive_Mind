import "server-only";
import { after } from "next/server";
import connectDB from "../db/connectDB";
import UsageEvent from "../models/UsageEvent";
import { hashQuotaIdentity } from "./quota-identity";

export type MeteredFeature =
    | "search"
    | "scholar_search"
    | "paper"
    | "discover"
    | "chat"
    | "projects";

export interface UsageContext {
    feature: MeteredFeature;
    userID?: string;
    anonymousId?: string;
    metadata?: Record<string, unknown>;
}

const MODEL_PRICES_PER_MILLION: Record<
    string,
    { input: number; output: number }
> = {
    "openai/gpt-4.1-mini": { input: 0.4, output: 1.6 },
    "openai/text-embedding-3-small": { input: 0.02, output: 0 },
};

export function estimateAiCostMicros(input: {
    model: string;
    inputTokens?: number;
    outputTokens?: number;
}) {
    const price = MODEL_PRICES_PER_MILLION[input.model];
    if (!price) return 0;
    return Math.round(
        (input.inputTokens || 0) * price.input +
            (input.outputTokens || 0) * price.output,
    );
}

export type UsageRecordInput = {
    context: UsageContext;
    provider: string;
    operation: string;
    model?: string;
    callCount?: number;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostMicros?: number;
    success?: boolean;
    metadata?: Record<string, unknown>;
};

export function deferUsageRecording(input: UsageRecordInput) {
    after(() => recordUsage(input));
}

export async function recordUsage(input: UsageRecordInput) {
    try {
        await connectDB();
        const expiresAt = new Date();
        expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
        await UsageEvent.create({
            userID: input.context.userID || undefined,
            anonymousId: input.context.anonymousId
                ? hashQuotaIdentity(input.context.anonymousId)
                : undefined,
            feature: input.context.feature,
            provider: input.provider,
            operation: input.operation,
            model: input.model,
            callCount: input.callCount ?? 1,
            inputTokens: input.inputTokens ?? 0,
            outputTokens: input.outputTokens ?? 0,
            estimatedCostMicros:
                input.estimatedCostMicros ??
                (input.model
                    ? estimateAiCostMicros({
                          model: input.model,
                          inputTokens: input.inputTokens,
                          outputTokens: input.outputTokens,
                      })
                    : 0),
            success: input.success ?? true,
            metadata: {
                ...input.context.metadata,
                ...input.metadata,
            },
            expiresAt,
        });
    } catch (error) {
        console.warn("Usage event could not be recorded", error);
    }
}
