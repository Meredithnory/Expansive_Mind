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
    _input: SavedSynthesisOpenInput,
): boolean {
    return false;
}
