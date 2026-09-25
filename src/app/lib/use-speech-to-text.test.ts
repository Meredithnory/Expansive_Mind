import { describe, expect, it } from "vitest";
import {
    audioFormatFromMime,
    isLikelyEmptyTranscript,
    parseTranscriptionRequest,
    speechErrorMessage,
} from "./speech-to-text";
import { finalSpeechTranscripts } from "./use-speech-to-text";

describe("finalSpeechTranscripts", () => {
    it("keeps only final spoken phrases", () => {
        expect(
            finalSpeechTranscripts(
                [
                    { isFinal: false, 0: { transcript: "draft " } },
                    { isFinal: true, 0: { transcript: " GLP-1 outcomes " } },
                    { isFinal: true, 0: { transcript: "" } },
                ],
                0,
            ),
        ).toEqual(["GLP-1 outcomes"]);
    });

    it("starts from the latest result index", () => {
        expect(
            finalSpeechTranscripts(
                [
                    { isFinal: true, 0: { transcript: "old" } },
                    { isFinal: true, 0: { transcript: "new question" } },
                ],
                1,
            ),
        ).toEqual(["new question"]);
    });
});

describe("speechErrorMessage", () => {
    it("ignores aborted and silent sessions", () => {
        expect(speechErrorMessage("aborted")).toBeNull();
        expect(speechErrorMessage("no-speech")).toBeNull();
    });

    it("maps common browser failures", () => {
        expect(speechErrorMessage("not-allowed")).toBe(
            "Microphone access was blocked.",
        );
        expect(speechErrorMessage("network")).toBe(
            "Voice input isn’t available in this browser.",
        );
        expect(speechErrorMessage("audio-capture")).toBe(
            "No microphone was found.",
        );
    });
});

describe("parseTranscriptionRequest", () => {
    it("accepts compact webm audio", () => {
        expect(
            parseTranscriptionRequest({
                audio: "UklGRiQA",
                format: "webm",
                language: "en-US",
            }),
        ).toEqual({
            ok: true,
            audio: "UklGRiQA",
            format: "webm",
            language: "en",
        });
    });

    it("rejects missing audio and unknown formats", () => {
        expect(parseTranscriptionRequest({ format: "webm" }).ok).toBe(false);
        expect(
            parseTranscriptionRequest({ audio: "UklGRiQA", format: "exe" }).ok,
        ).toBe(false);
    });
});

describe("isLikelyEmptyTranscript", () => {
    it("rejects common silent-audio hallucinations", () => {
        expect(isLikelyEmptyTranscript("Thank you.")).toBe(true);
        expect(isLikelyEmptyTranscript("Thanks for watching")).toBe(true);
        expect(isLikelyEmptyTranscript("GLP-1 outcomes in CKD")).toBe(false);
    });
});

describe("audioFormatFromMime", () => {
    it("maps browser recorder types", () => {
        expect(audioFormatFromMime("audio/webm;codecs=opus")).toBe("webm");
        expect(audioFormatFromMime("audio/mp4")).toBe("mp4");
        expect(audioFormatFromMime("audio/ogg")).toBe("ogg");
    });
});
