const GOOGLE_AUTH_ERRORS: Record<string, string> = {
    unavailable:
        "Google sign-in is not available right now. Use email and password.",
    denied: "Google sign-in was canceled.",
    unverified: "Google has not verified that email yet.",
    failed: "Google sign-in did not complete. Please try again.",
    limited: "Too many sign-in attempts. Try again later.",
};

export function googleAuthErrorMessage(code: string | null | undefined) {
    if (!code) return null;
    return GOOGLE_AUTH_ERRORS[code] ?? null;
}
