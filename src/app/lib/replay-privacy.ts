// What PostHog session recordings must not show. Paper text (bodies,
// abstracts, quoted passages, highlights, paper chats) is recorded as
// asterisks, so a recording keeps the layout and clicks but not the words.
// The admin portal, with people's names and emails, is left out entirely.
// Typed text is masked by PostHog's own default (maskAllInputs).

/** Text inside is recorded as asterisks. PostHog's default mask class. */
export const REPLAY_MASK = "ph-mask";

/** Recorded as an empty box, and clicks inside aren't captured. */
export const REPLAY_BLOCK = "ph-no-capture";
