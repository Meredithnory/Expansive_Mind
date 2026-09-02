"use client";
import React, { FormEvent, useState } from "react";
import styles from "./signuppage.module.scss";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LoadingOverlay } from "../components/Loading";
import posthog from "posthog-js";
import { useSession } from "../lib/use-session";

const perks = [
    { label: "Search", detail: "NIH, Nature, and Scholar" },
    { label: "Save", detail: "Keep papers in one place" },
    { label: "Chat", detail: "Ask the paper anything" },
];

function signupDestination() {
    const requested = new URLSearchParams(window.location.search).get("next");
    return requested === "/pricing?intent=monthly"
        ? requested
        : "/discover";
}

const SignupPage = () => {
    const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();
    const { refresh } = useSession();

    const passwordReady = password.length >= 6;
    const passwordHint =
        password.length === 0
            ? "At least 6 characters — something you will remember."
            : passwordReady
              ? "Nice. That password is long enough."
              : `${6 - password.length} more character${
                    6 - password.length === 1 ? "" : "s"
                } to go.`;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setStatus("idle");
        setMessage("");
        setLoading(true);

        const formData = new FormData(event.currentTarget);
        let succeeded = false;
        try {
            const response = await fetch("/api/signup", {
                method: "POST",
                body: formData,
            });
            const data = (await response.json().catch(() => ({}))) as {
                success?: boolean;
                error?: string;
            };

            if (data.success) {
                succeeded = true;
                setStatus("success");
                setMessage("You're in — opening your workspace…");
                posthog.capture("signup_completed");
                await refresh();
                router.push(signupDestination());
                router.refresh();
                return;
            }

            const alreadyRegistered = /already registered/i.test(
                data.error || "",
            );
            setStatus("error");
            setMessage(
                alreadyRegistered
                    ? "That email already has an account."
                    : data.error ||
                          "We couldn't create your account. Please try again.",
            );
        } catch (error) {
            console.error("Error:", error);
            setStatus("error");
            setMessage("Something went sideways. Give it another try.");
        } finally {
            if (!succeeded) setLoading(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <aside className={styles.welcome}>
                    <p className={styles.eyebrow}>Free to start</p>
                    <h1>Let&apos;s expand your mind</h1>
                    <p className={styles.lede}>
                        Search, save, and chat with papers — about 30 seconds,
                        then you&apos;re in. No credit card.
                    </p>
                    <ul className={styles.perks}>
                        {perks.map((perk) => (
                            <li key={perk.label}>
                                <span className={styles.perkLabel}>
                                    {perk.label}
                                </span>
                                <span className={styles.perkDetail}>
                                    {perk.detail}
                                </span>
                            </li>
                        ))}
                    </ul>
                </aside>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.formIntro}>
                        <h2>Create your free account</h2>
                        <p>We&apos;ll take you straight to search after this.</p>
                    </div>

                    {message ? (
                        <div
                            className={
                                status === "error"
                                    ? styles.errorBanner
                                    : styles.successBanner
                            }
                            role={status === "error" ? "alert" : "status"}
                        >
                            {message}
                            {status === "error" &&
                            message.includes("already has an account") ? (
                                <>
                                    {" "}
                                    <Link href="/login">Sign in instead</Link>
                                </>
                            ) : null}
                        </div>
                    ) : null}

                    <div className={styles.nameRow}>
                        <div className={styles.field}>
                            <label htmlFor="first_name">First name</label>
                            <input
                                id="first_name"
                                type="text"
                                name="first_name"
                                autoComplete="given-name"
                                placeholder="Ada"
                                required
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="last_name">Last name</label>
                            <input
                                id="last_name"
                                type="text"
                                name="last_name"
                                autoComplete="family-name"
                                placeholder="Lovelace"
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="email">Email</label>
                        <div className={styles.inputWrap}>
                            <Image
                                src="/emailicon.svg"
                                alt=""
                                width={20}
                                height={16}
                                className={styles.icon}
                            />
                            <input
                                id="email"
                                type="email"
                                name="email"
                                autoComplete="email"
                                inputMode="email"
                                placeholder="you@university.edu"
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="password">Password</label>
                        <div className={styles.inputWrap}>
                            <Image
                                src="/lockicon.svg"
                                alt=""
                                width={18}
                                height={21}
                                className={styles.icon}
                            />
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                name="password"
                                autoComplete="new-password"
                                placeholder="Create a password"
                                minLength={6}
                                required
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                aria-describedby="password-hint"
                            />
                            <button
                                type="button"
                                className={styles.togglePassword}
                                onClick={() =>
                                    setShowPassword((visible) => !visible)
                                }
                                aria-pressed={showPassword}
                                aria-label={
                                    showPassword
                                        ? "Hide password"
                                        : "Show password"
                                }
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </div>
                        <span
                            id="password-hint"
                            className={
                                passwordReady
                                    ? styles.hintReady
                                    : styles.hint
                            }
                        >
                            {passwordHint}
                        </span>
                    </div>

                    <button
                        type="submit"
                        className={styles.submit}
                        disabled={loading}
                    >
                        {loading
                            ? "Creating your account…"
                            : "Create free account"}
                    </button>

                    <p className={styles.signIn}>
                        Already exploring? <Link href="/login">Sign in</Link>
                    </p>
                </form>
            </div>
            <LoadingOverlay
                visible={loading}
                label="Creating your account…"
            />
        </div>
    );
};

export default SignupPage;
