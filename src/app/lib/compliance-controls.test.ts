import { describe, expect, it } from "vitest";
import Message from "../models/Message";
import { OPENROUTER_PROVIDER_POLICY } from "./openrouter-policy";

describe("compliance controls", () => {
    it("requires private OpenRouter routing", () => {
        expect(OPENROUTER_PROVIDER_POLICY).toEqual({
            data_collection: "deny",
            zdr: true,
        });
    });

    it("does not auto-expire chat messages", () => {
        const ttlIndexes = Message.schema
            .indexes()
            .filter(([, options]) => options.expireAfterSeconds != null);
        expect(ttlIndexes).toEqual([]);
    });
});
