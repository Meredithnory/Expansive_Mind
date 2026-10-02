import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REPLAY_BLOCK, REPLAY_MASK } from "./replay-privacy";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("session recordings leave out paper text and the admin portal", () => {
    it("uses PostHog's own class names, set explicitly at init", () => {
        expect(REPLAY_MASK).toBe("ph-mask");
        expect(REPLAY_BLOCK).toBe("ph-no-capture");
        const init = read("instrumentation-client.ts");
        expect(init).toMatch(/maskAllInputs:\s*true/);
        expect(init).toMatch(/maskTextClass:\s*REPLAY_MASK/);
        expect(init).toMatch(/blockClass:\s*REPLAY_BLOCK/);
    });

    it("masks the paper body and abstract in the reader", () => {
        const paperbox = read("src/app/components/paperchatbot/Paperbox.tsx");
        expect(paperbox).toMatch(/className=\{clsx\(styles\.paper, REPLAY_MASK\)\} data-paper-body/);
        expect(paperbox.match(/clsx\(styles\.paper, REPLAY_MASK\)/g)).toHaveLength(2);
    });

    it("masks paper chats and every quoted or highlighted passage", () => {
        expect(read("src/app/components/paperchatbot/Chatbox.tsx")).toMatch(/clsx\(styles\.messages, REPLAY_MASK\)/);
        expect(read("src/app/discover/QuoteWithAttribution.tsx")).toMatch(/<blockquote className=\{clsx\(className, REPLAY_MASK\)\}>/);
        expect(read("src/app/discover/ClaimLedgerView.tsx")).toMatch(/<blockquote className=\{clsx\(styles\.quote, REPLAY_MASK\)\}>/);
        for (const file of [
            "src/app/savedpapers/HighlightsTab.tsx",
            "src/app/savedpapers/ShareToGroup.tsx",
            "src/app/groups/[id]/page.tsx",
            "src/app/forum/ForumPostCard.tsx",
            "src/app/shared/paper/[slug]/page.tsx",
        ]) {
            expect(read(file), file).toMatch(/className=\{REPLAY_MASK\}>\{highlight\.excerpt\}|<blockquote className=\{REPLAY_MASK\}>/);
        }
    });

    it("leaves the admin portal out of recordings", () => {
        expect(read("src/app/admin/AdminShell.tsx")).toMatch(/clsx\(styles\.shell, REPLAY_BLOCK\)\} data-admin-portal/);
    });
});
