import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";

const ISSUER = "Expansive Mind Admin";
const PERIOD = 30;

function totpKey() {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is required.");
    }
    return createHash("sha256")
        .update(`${process.env.JWT_SECRET}:admin-totp`)
        .digest();
}

export function encryptTotpSecret(secret: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", totpKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(secret, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptTotpSecret(payload: string) {
    const [ivPart, tagPart, dataPart] = payload.split(".");
    if (!ivPart || !tagPart || !dataPart) {
        throw new Error("Invalid TOTP secret.");
    }
    const decipher = createDecipheriv(
        "aes-256-gcm",
        totpKey(),
        Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
        decipher.update(Buffer.from(dataPart, "base64url")),
        decipher.final(),
    ]).toString("utf8");
}

function totpFor(secret: string, label: string) {
    return new TOTP({
        issuer: ISSUER,
        label,
        algorithm: "SHA1",
        digits: 6,
        period: PERIOD,
        secret: Secret.fromBase32(secret),
    });
}

export function createTotpSecret() {
    return new Secret({ size: 20 }).base32;
}

export function totpKeyUri(secret: string, label: string) {
    return totpFor(secret, label).toString();
}

export async function totpQrDataUrl(secret: string, label: string) {
    return QRCode.toDataURL(totpKeyUri(secret, label), {
        margin: 1,
        width: 220,
        color: { dark: "#0d0d0d", light: "#ffffff" },
    });
}

export function normalizeTotpCode(value: string) {
    return value.replace(/\s+/g, "");
}

export function verifyTotpCode(input: {
    secret: string;
    label: string;
    code: string;
    lastStep?: number | null;
    at?: Date;
}) {
    const code = normalizeTotpCode(input.code);
    if (!/^\d{6}$/.test(code)) return { ok: false as const };
    const totp = totpFor(input.secret, input.label);
    const delta = totp.validate({
        token: code,
        window: 1,
        timestamp: (input.at ?? new Date()).getTime(),
    });
    if (delta === null) return { ok: false as const };
    const step =
        Math.floor((input.at ?? new Date()).getTime() / 1000 / PERIOD) + delta;
    if (input.lastStep === step) return { ok: false as const };
    return { ok: true as const, step };
}
