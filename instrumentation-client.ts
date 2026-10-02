import posthog from "posthog-js";
import { REPLAY_BLOCK, REPLAY_MASK } from "./src/app/lib/replay-privacy";

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host:
            process.env.NEXT_PUBLIC_POSTHOG_HOST ||
            "https://us.i.posthog.com",
        defaults: "2025-05-24",
        // Recordings never carry typed text, paper text, or the admin portal.
        session_recording: {
            maskAllInputs: true,
            maskTextClass: REPLAY_MASK,
            blockClass: REPLAY_BLOCK,
        },
    });
}
