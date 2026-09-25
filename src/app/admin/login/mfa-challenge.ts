export const ADMIN_MFA_CHALLENGE_KEY = "em_admin_mfa_challenge";

type ChallengeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function storeAdminMfaChallenge(storage: ChallengeStorage, token: string) {
    if (!token) {
        storage.removeItem(ADMIN_MFA_CHALLENGE_KEY);
        return;
    }
    storage.setItem(ADMIN_MFA_CHALLENGE_KEY, token);
}

export function readStoredAdminMfaChallenge(storage: ChallengeStorage | null) {
    if (!storage) return "";
    try {
        return storage.getItem(ADMIN_MFA_CHALLENGE_KEY) || "";
    } catch {
        return "";
    }
}

// React state is cleared if the authenticator step stays mounted after a
// successful verify (router.refresh on the login route). The password-step
// challenge in sessionStorage still has to be submitted, or the server
// answers "Sign in with your password first."
export function adminMfaChallengeForSubmit(input: {
    stateToken: string;
    storedToken: string | null;
}) {
    return input.stateToken || input.storedToken || "";
}
