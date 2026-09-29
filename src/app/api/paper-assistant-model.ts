// The paper assistant (paper chat and figure chat) runs on Claude through
// OpenRouter, under the same zero-data-retention provider policy as every
// other AI call. Haiku keeps each answer inside the chat cost budget (owner
// decision 2026-09-28). FIGURE_VISION_MODEL still overrides figure chat.
export const PAPER_ASSISTANT_MODEL = "anthropic/claude-haiku-4.5";
