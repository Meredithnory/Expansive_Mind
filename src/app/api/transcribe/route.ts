import { NextRequest, NextResponse } from "next/server";
import { withOptionalAuth } from "../authMiddleware";
import { createPrivateTranscription } from "../openrouter";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";
import {
    InvalidJsonRequest,
    hasValidMutationOrigin,
    readBoundedJson,
} from "../../lib/request-security";
import {
    MAX_TRANSCRIBE_AUDIO_CHARS,
    parseTranscriptionRequest,
} from "../../lib/speech-to-text";

export const POST = withOptionalAuth(async (req: NextRequest) => {
    if (!hasValidMutationOrigin(req)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }

    try {
        const identity = req.user?._id?.toString() || requestIp(req);
        const rateLimit = await consumeRateLimit({
            scope: "transcribe",
            identity,
            limit: req.user ? 12 : 6,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "Voice input rate limit reached." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }

        const parsed = parseTranscriptionRequest(
            await readBoundedJson(req, MAX_TRANSCRIBE_AUDIO_CHARS + 512),
        );
        if (!parsed.ok) {
            return NextResponse.json(
                { error: parsed.error },
                { status: parsed.status },
            );
        }

        const text = await createPrivateTranscription(
            {
                audioBase64: parsed.audio,
                format: parsed.format,
                language: parsed.language,
            },
            {
                feature: "discover",
                userID: req.user?._id?.toString(),
                anonymousId: req.user ? undefined : identity,
            },
        );
        return NextResponse.json(
            { text: text.trim() },
            { headers: { "Cache-Control": "private, no-store" } },
        );
    } catch (error) {
        if (error instanceof InvalidJsonRequest) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }
        console.error("Voice transcription failed");
        return NextResponse.json(
            { error: "Voice input could not be transcribed." },
            { status: 500 },
        );
    }
});
