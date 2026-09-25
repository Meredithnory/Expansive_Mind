export const TRANSCRIBE_FORMATS = [
    "webm",
    "mp4",
    "m4a",
    "ogg",
    "wav",
] as const;

export type TranscribeFormat = (typeof TRANSCRIBE_FORMATS)[number];

export const MAX_TRANSCRIBE_AUDIO_CHARS = 1_800_000;
export const MAX_VOICE_SECONDS = 45;
export const MIN_VOICE_MS = 1200;

const EMPTY_TRANSCRIPTS = new Set([
    "thank you",
    "thanks",
    "thanks for watching",
    "thank you for watching",
    "please subscribe",
    "bye",
    "you",
]);

export function isLikelyEmptyTranscript(text: string) {
    const normalized = text
        .trim()
        .toLowerCase()
        .replace(/[.!?…]+$/g, "")
        .trim();
    return !normalized || EMPTY_TRANSCRIPTS.has(normalized);
}

export function speechErrorMessage(error?: string): string | null {
    if (!error || error === "aborted" || error === "no-speech") return null;
    if (error === "not-allowed" || error === "service-not-allowed") {
        return "Microphone access was blocked.";
    }
    if (error === "audio-capture") {
        return "No microphone was found.";
    }
    if (error === "network") {
        return "Voice input isn’t available in this browser.";
    }
    return "Voice input stopped unexpectedly.";
}

export function audioFormatFromMime(mime: string): TranscribeFormat {
    const type = mime.split(";")[0]?.trim().toLowerCase() ?? "";
    if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) {
        return type.includes("m4a") ? "m4a" : "mp4";
    }
    if (type.includes("ogg")) return "ogg";
    if (type.includes("wav")) return "wav";
    return "webm";
}

export function parseTranscriptionRequest(data: Record<string, unknown>):
    | { ok: true; audio: string; format: TranscribeFormat; language?: string }
    | { ok: false; status: number; error: string } {
    const audio = typeof data.audio === "string" ? data.audio.trim() : "";
    const format = typeof data.format === "string" ? data.format.trim().toLowerCase() : "";
    const language =
        typeof data.language === "string" ? data.language.trim().toLowerCase() : "";

    if (!audio || !/^[A-Za-z0-9+/]+=*$/.test(audio)) {
        return { ok: false, status: 400, error: "Audio is required." };
    }
    if (audio.length > MAX_TRANSCRIBE_AUDIO_CHARS) {
        return { ok: false, status: 413, error: "Recording is too long." };
    }
    if (!TRANSCRIBE_FORMATS.includes(format as TranscribeFormat)) {
        return { ok: false, status: 400, error: "Unsupported audio format." };
    }
    if (language && !/^[a-z]{2}(?:-[a-z]{2})?$/.test(language)) {
        return { ok: false, status: 400, error: "Unsupported language." };
    }

    return {
        ok: true,
        audio,
        format: format as TranscribeFormat,
        ...(language ? { language: language.slice(0, 2) } : {}),
    };
}
