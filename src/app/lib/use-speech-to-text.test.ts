import { describe, expect, it } from "vitest";
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
