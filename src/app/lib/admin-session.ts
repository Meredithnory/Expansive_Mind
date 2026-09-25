import { SignJWT, jwtVerify } from "jose";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_MFA_COOKIE = "admin_mfa";
export const ADMIN_SESSION_MAX_AGE = 4 * 60 * 60;
export const ADMIN_MFA_MAX_AGE = 10 * 60;
export const AUTH_COOKIE = "auth_token";
export const AUTH_MAX_AGE = 24 * 60 * 60;

export type AdminMfaStage = "setup" | "verify";
export type AdminMfaPayload = {
    id: string;
    stage: AdminMfaStage;
    secretEnc?: string;
};

function cookieOptions(maxAge: number) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict" as const,
        maxAge,
        path: "/",
    };
}

export function adminSessionCookieOptions(maxAge = ADMIN_SESSION_MAX_AGE) {
    return cookieOptions(maxAge);
}

export function adminMfaCookieOptions(maxAge = ADMIN_MFA_MAX_AGE) {
    return cookieOptions(maxAge);
}

export function authCookieOptions(maxAge = AUTH_MAX_AGE) {
    return cookieOptions(maxAge);
}

function jwtSecret() {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is required.");
    }
    return new TextEncoder().encode(process.env.JWT_SECRET);
}

export async function createAdminSessionToken(userId: string) {
    return new SignJWT({ id: userId, role: "admin" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${ADMIN_SESSION_MAX_AGE}s`)
        .sign(jwtSecret());
}

export async function readAdminSession(token?: string) {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, jwtSecret());
        if (
            payload.role !== "admin" ||
            typeof payload.id !== "string" ||
            !payload.id
        ) {
            return null;
        }
        return { id: payload.id };
    } catch {
        return null;
    }
}

export async function readAdminSessionFromRequest(request: {
    cookies: { get(name: string): { value: string } | undefined };
}) {
    return readAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function adminLoginTokens(userId: string) {
    const [authToken, adminToken] = await Promise.all([
        createAuthSessionToken(userId),
        createAdminSessionToken(userId),
    ]);
    return { authToken, adminToken };
}

export async function createAuthSessionToken(userId: string) {
    return new SignJWT({ id: userId })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${AUTH_MAX_AGE}s`)
        .sign(jwtSecret());
}

export async function createAdminMfaToken(input: AdminMfaPayload) {
    const token = new SignJWT({
        id: input.id,
        role: "admin-mfa",
        stage: input.stage,
        secretEnc: input.secretEnc || "",
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${ADMIN_MFA_MAX_AGE}s`);
    return token.sign(jwtSecret());
}

export async function readAdminMfa(token?: string): Promise<AdminMfaPayload | null> {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, jwtSecret());
        if (
            payload.role !== "admin-mfa" ||
            (payload.stage !== "setup" && payload.stage !== "verify") ||
            typeof payload.id !== "string" ||
            !payload.id
        ) {
            return null;
        }
        return {
            id: payload.id,
            stage: payload.stage,
            secretEnc:
                typeof payload.secretEnc === "string" && payload.secretEnc
                    ? payload.secretEnc
                    : undefined,
        };
    } catch {
        return null;
    }
}

export async function readAdminMfaFromRequest(request: {
    cookies: { get(name: string): { value: string } | undefined };
}) {
    return readAdminMfa(request.cookies.get(ADMIN_MFA_COOKIE)?.value);
}
