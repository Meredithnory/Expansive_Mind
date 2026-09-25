"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "../login/login.module.scss";
import {
    PASSWORD_RESET_LINK_INVALID,
    PASSWORD_RESET_UPDATED,
} from "../lib/password-reset-copy";

type Phase = "idle" | "submitting" | "success" | "error";

export default function ResetPasswordClient() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token")?.trim() ?? "";
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [phase, setPhase] = useState<Phase>("idle");

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (password !== confirmPassword) {
            setError("Those passwords don't match.");
            setPhase("error");
            return;
        }

        setLoading(true);
        setError("");
        setPhase("submitting");

        try {
            const response = await fetch("/api/password-reset/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok && data.success) {
                setPhase("success");
                return;
            }
            setError(data.message || "We couldn't update that password.");
            setPhase("error");
        } catch {
            setError("Network error. Please try again.");
            setPhase("error");
        } finally {
            setLoading(false);
        }
    };

    const boxClassName = [
        styles.loginBox,
        phase === "submitting" ? styles.isSubmitting : "",
        phase === "error" ? styles.isError : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={styles.page}>
            <div className={boxClassName}>
                <div
                    className={styles.loginContainer}
                    onAnimationEnd={(event) => {
                        if (
                            phase === "error" &&
                            event.target === event.currentTarget
                        ) {
                            setPhase("idle");
                        }
                    }}
                >
                    <div className={styles.loginText}>New password</div>
                    {!token ? (
                        <div className={styles.maincontent}>
                            <p className={styles.signupPrompt}>
                                {PASSWORD_RESET_LINK_INVALID}
                            </p>
                            <p className={styles.signupPrompt}>
                                <Link href="/forgot-password">
                                    Request a new link
                                </Link>
                            </p>
                        </div>
                    ) : phase === "success" ? (
                        <div className={styles.maincontent}>
                            <p className={styles.signupPrompt}>
                                {PASSWORD_RESET_UPDATED}
                            </p>
                            <p className={styles.signupPrompt}>
                                <Link href="/login">Log in</Link>
                            </p>
                        </div>
                    ) : (
                        <form className={styles.maincontent} onSubmit={handleSubmit}>
                            {error && <div className={styles.error}>{error}</div>}
                            <p className={styles.signupPrompt}>
                                Choose a new password. This link works once.
                            </p>
                            <div className={styles.password}>
                                New password
                                <div className={styles.inputwrapper}>
                                    <Image
                                        src="/lockicon.svg"
                                        alt="Lock icon"
                                        width={24}
                                        height={24}
                                        className={styles.icon}
                                    />
                                    <input
                                        type="password"
                                        name="password"
                                        placeholder="Type a new password"
                                        value={password}
                                        onChange={(event) =>
                                            setPassword(event.target.value)
                                        }
                                        required
                                        disabled={loading}
                                        autoComplete="new-password"
                                        minLength={6}
                                        maxLength={128}
                                    />
                                </div>
                            </div>
                            <div className={styles.password}>
                                Confirm password
                                <div className={styles.inputwrapper}>
                                    <Image
                                        src="/lockicon.svg"
                                        alt="Lock icon"
                                        width={24}
                                        height={24}
                                        className={styles.icon}
                                    />
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        placeholder="Type it again"
                                        value={confirmPassword}
                                        onChange={(event) =>
                                            setConfirmPassword(event.target.value)
                                        }
                                        required
                                        disabled={loading}
                                        autoComplete="new-password"
                                        minLength={6}
                                        maxLength={128}
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className={[
                                    styles.loginButton,
                                    phase === "submitting"
                                        ? styles.isThinking
                                        : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                                disabled={loading}
                                aria-busy={loading}
                            >
                                {loading ? "Saving..." : "Save new password"}
                            </button>
                            <p className={styles.signupPrompt}>
                                <Link href="/login">Back to login</Link>
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
