/** View gate for `/discover?saved=` so the Discover landing does not paint first. */

export type SavedSynthesisOpenInput = {
    savedParam: string;
    hasResult: boolean;
    hasError: boolean;
    sessionLoading: boolean;
    historyLoading: boolean;
    isLoggedIn: boolean;
};

export function isOpeningSavedSynthesis(
    input: SavedSynthesisOpenInput,
): boolean {
    if (!input.savedParam) return false;
    if (input.hasResult || input.hasError) return false;
    if (input.sessionLoading || input.historyLoading) return true;
    return input.isLoggedIn;
}
