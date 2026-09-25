"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "../login/login.module.scss";
import { PASSWORD_RESET_REQUEST_MESSAGE } from "../lib/password-reset-copy";

type Phase = "idle" | "submitting" | "success" | "error";

export default function ForgotPasswordClient() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [phase, setPhase] = useState<Phase>("idle");

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        setPhase("submitting");

        try {
            const response = await fetch("/api/password-reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok && data.success) {
                setPhase("success");
                return;
            }
            setError(data.message || "We couldn't send that just now.");
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
                    <div className={styles.loginText}>Reset password</div>
                    {phase === "success" ? (
                        <div className={styles.maincontent}>
                            <p className={styles.signupPrompt}>
                                {PASSWORD_RESET_REQUEST_MESSAGE}
                            </p>
                            <p className={styles.signupPrompt}>
                                <Link href="/login">Back to login</Link>
                            </p>
                        </div>
                    ) : (
                        <form className={styles.maincontent} onSubmit={handleSubmit}>
                            {error && <div className={styles.error}>{error}</div>}
                            <p className={styles.signupPrompt}>
                                We&apos;ll email you a link to choose a new
                                password.
                            </p>
                            <div className={styles.email}>
                                Email
                                <div className={styles.inputwrapper}>
                                    <Image
                                        src="/emailicon.svg"
                                        alt="Email icon"
                                        width={24}
                                        height={24}
                                        className={styles.icon}
                                    />
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="Type your email"
                                        value={email}
                                        onChange={(event) =>
                                            setEmail(event.target.value)
                                        }
                                        required
                                        disabled={loading}
                                        autoComplete="email"
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
                                {loading ? "Sending..." : "Send reset link"}
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
