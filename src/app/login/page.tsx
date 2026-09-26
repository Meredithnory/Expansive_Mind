"use client";
import React, { useState } from "react";
import styles from "./login.module.scss";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "../lib/use-session";
import { safeInternalPath } from "../lib/safe-internal-path";
import {
    ContinueWithGoogle,
    useGoogleAuthNotice,
} from "../components/ContinueWithGoogle";

type LoginPhase = "idle" | "submitting" | "success" | "error";

const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const googleNotice = useGoogleAuthNotice();
    const [phase, setPhase] = useState<LoginPhase>("idle");
    const router = useRouter();
    const { refresh } = useSession();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setPhase("submitting");

        let succeeded = false;

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                succeeded = true;
                setPhase("success");
                await refresh();

                if (!prefersReducedMotion()) {
                    await new Promise((resolve) => setTimeout(resolve, 420));
                }

                const nextPath = safeInternalPath(
                    new URLSearchParams(window.location.search).get("next"),
                );
                router.push(nextPath);
                router.refresh();
            } else {
                setError(data.message || "Login failed");
                setPhase("error");
            }
        } catch {
            setError("Network error. Please try again.");
            setPhase("error");
        } finally {
            if (!succeeded) {
                setLoading(false);
            }
        }
    };

    const boxClassName = [
        styles.loginBox,
        phase === "submitting" ? styles.isSubmitting : "",
        phase === "success" ? styles.isSuccess : "",
        phase === "error" ? styles.isError : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <>
            <div className={styles.page}>
                <div className={boxClassName}>
                    <div
                        className={styles.loginContainer}
                        onAnimationEnd={(e) => {
                            if (
                                phase === "error" &&
                                e.target === e.currentTarget
                            ) {
                                setPhase("idle");
                            }
                        }}
                    >
                        <div className={styles.loginText}>Login</div>

                        {(error || googleNotice) && (
                            <div className={styles.error}>
                                {error || googleNotice}
                            </div>
                        )}
                        <form
                            className={styles.maincontent}
                            onSubmit={handleLogin}
                        >
                            <div className={styles.googleSlot}>
                                <ContinueWithGoogle intent="login" />
                            </div>
                            <div className={styles.email}>
                                Email
                                <div className={styles.inputwrapper}>
                                    <Image
                                        src="emailicon.svg"
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
                                        onChange={(e) =>
                                            setEmail(e.target.value)
                                        }
                                        required
                                        disabled={
                                            loading || phase === "success"
                                        }
                                        autoComplete="email"
                                    />
                                </div>
                            </div>
                            <div className={styles.password}>
                                Password
                                <div className={styles.inputwrapper}>
                                    <Image
                                        src="lockicon.svg"
                                        alt="Lock icon"
                                        width={24}
                                        height={24}
                                        className={styles.icon}
                                    />
                                    <input
                                        type="password"
                                        name="password"
                                        placeholder="Type your password"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        required
                                        disabled={
                                            loading || phase === "success"
                                        }
                                        autoComplete="current-password"
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
                                    phase === "success"
                                        ? styles.isSuccessButton
                                        : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                                disabled={loading || phase === "success"}
                                aria-busy={loading || phase === "success"}
                            >
                                {phase === "success"
                                    ? "Welcome in"
                                    : loading
                                      ? "Logging in..."
                                      : "Login"}
                            </button>
                            <p className={styles.signupPrompt}>
                                Don&apos;t have an account?{" "}
                                <Link href="/signup">Sign up</Link>
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LoginPage;
