"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Loading from "../../components/Loading";
import { useSession } from "../../lib/use-session";
import styles from "../../login/login.module.scss";

type Step = "credentials" | "setup" | "verify";

export default function AdminLoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [qrDataUrl, setQrDataUrl] = useState("");
    const [manualKey, setManualKey] = useState("");
    const [mfaToken, setMfaToken] = useState("");
    const [step, setStep] = useState<Step>("credentials");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const { refresh } = useSession();

    const finishLogin = async () => {
        await refresh();
        router.push("/admin");
        router.refresh();
    };

    const handlePassword = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        try {
            const response = await fetch("/api/admin/login", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok && data.mfa === "setup") {
                setQrDataUrl(String(data.qrDataUrl || ""));
                setManualKey(String(data.manualKey || ""));
                setMfaToken(String(data.mfaToken || ""));
                setPassword("");
                setStep("setup");
                return;
            }
            if (response.ok && data.mfa === "verify") {
                setMfaToken(String(data.mfaToken || ""));
                setPassword("");
                setStep("verify");
                return;
            }
            setError(data.message || "Invalid email or password.");
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleCode = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        try {
            const response = await fetch("/api/admin/login/totp", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, mfaToken }),
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok && data.success) {
                setMfaToken("");
                await finishLogin();
                return;
            }
            setError(data.message || "Invalid authentication code.");
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.loginBox}>
                <div className={styles.loginContainer}>
                    <div className={styles.loginText}>Admin</div>
                    <p className={styles.signupPrompt}>
                        {step === "credentials"
                            ? "Staff access only. After your password, you’ll confirm with an authenticator app."
                            : step === "setup"
                              ? "Scan this QR code in Authy, Google Authenticator, or 1Password, then enter the 6-digit code."
                              : "Enter the 6-digit code from your authenticator app."}
                    </p>
                    {error && <div className={styles.error}>{error}</div>}
                    {step === "credentials" ? (
                        <form
                            className={styles.maincontent}
                            onSubmit={handlePassword}
                        >
                            <div className={styles.email}>
                                Email
                                <div className={styles.inputwrapper}>
                                    <Image
                                        src="/emailicon.svg"
                                        alt=""
                                        width={24}
                                        height={24}
                                        className={styles.icon}
                                    />
                                    <input
                                        type="email"
                                        name="email"
                                        autoComplete="username"
                                        placeholder="Admin email"
                                        value={email}
                                        onChange={(event) =>
                                            setEmail(event.target.value)
                                        }
                                        required
                                    />
                                </div>
                            </div>
                            <div className={styles.password}>
                                Password
                                <div className={styles.inputwrapper}>
                                    <Image
                                        src="/lockicon.svg"
                                        alt=""
                                        width={24}
                                        height={24}
                                        className={styles.icon}
                                    />
                                    <input
                                        type="password"
                                        name="password"
                                        autoComplete="current-password"
                                        placeholder="Admin password"
                                        value={password}
                                        onChange={(event) =>
                                            setPassword(event.target.value)
                                        }
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className={styles.loginButton}
                                disabled={loading}
                            >
                                {loading ? "Checking…" : "Continue"}
                            </button>
                        </form>
                    ) : (
                        <form
                            className={styles.maincontent}
                            onSubmit={handleCode}
                        >
                            {step === "setup" && qrDataUrl && (
                                <div className={styles.qrWrap}>
                                    <img
                                        className={styles.qr}
                                        src={qrDataUrl}
                                        alt="Authenticator QR code"
                                    />
                                    {manualKey && (
                                        <p className={styles.manualKey}>
                                            {manualKey}
                                        </p>
                                    )}
                                </div>
                            )}
                            <div className={`${styles.password} ${styles.codeInput}`}>
                                Authentication code
                                <input
                                    type="text"
                                    name="code"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]{6}"
                                    maxLength={6}
                                    placeholder="123456"
                                    value={code}
                                    onChange={(event) =>
                                        setCode(
                                            event.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 6),
                                        )
                                    }
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className={styles.loginButton}
                                disabled={loading || code.length !== 6}
                            >
                                {loading ? "Verifying…" : "Verify code"}
                            </button>
                        </form>
                    )}
                    {loading && (
                        <div className={styles.loader}>
                            <Loading />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
