"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
    CONTACT_TOPICS,
    DEVELOPER_EMAIL,
    DEVELOPER_NAME,
} from "../lib/contact";
import { useSession } from "../lib/use-session";
import styles from "./contact.module.scss";

const ContactPage = () => {
    const { user } = useSession();
    const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const defaultName = user
        ? `${user.firstName} ${user.lastName}`.trim()
        : "";
    const defaultEmail = user?.email ?? "";

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 1800);
        return () => window.clearTimeout(timer);
    }, [copied]);

    const copyEmail = async () => {
        try {
            await navigator.clipboard.writeText(DEVELOPER_EMAIL);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setStatus("idle");
        setMessage("");
        setLoading(true);

        const form = event.currentTarget;
        const formData = new FormData(form);
        const payload = {
            name: String(formData.get("name") || ""),
            email: String(formData.get("email") || ""),
            topic: String(formData.get("topic") || ""),
            message: String(formData.get("message") || ""),
            website: String(formData.get("website") || ""),
        };

        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = (await response.json().catch(() => ({}))) as {
                success?: boolean;
                delivered?: "inbox" | "mailto";
                mailto?: string;
                error?: string;
            };

            if (!response.ok || !data.success) {
                setStatus("error");
                setMessage(
                    data.error ||
                        "We couldn't send that just now. Email Meredith directly?",
                );
                return;
            }

            if (data.delivered === "mailto") {
                window.location.href =
                    data.mailto || `mailto:${DEVELOPER_EMAIL}`;
                setStatus("success");
                setMessage(
                    "Your email app should open with the note addressed to Meredith.",
                );
            } else {
                form.reset();
                setStatus("success");
                setMessage("Sent — it just landed in Meredith's inbox.");
            }
        } catch (error) {
            console.error("Error:", error);
            setStatus("error");
            setMessage("Something went sideways. Give it another try.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <aside className={styles.welcome}>
                    <p className={styles.eyebrow}>A human on the other end</p>
                    <h1>Say hello to {DEVELOPER_NAME.split(" ")[0]}</h1>
                    <p className={styles.lede}>
                        Expansive Mind is built by {DEVELOPER_NAME}. Questions,
                        bugs, ideas, or a quick hello — it all goes to her inbox.
                    </p>
                    <div className={styles.emailCard}>
                        <span className={styles.emailLabel}>Developer email</span>
                        <a
                            className={styles.emailLink}
                            href={`mailto:${DEVELOPER_EMAIL}`}
                        >
                            {DEVELOPER_EMAIL}
                        </a>
                        <div className={styles.emailActions}>
                            <a
                                className={styles.emailButton}
                                href={`mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent("Expansive Mind")}`}
                            >
                                Open email app
                            </a>
                            <button
                                type="button"
                                className={styles.copyButton}
                                onClick={copyEmail}
                            >
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>
                    </div>
                </aside>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.formIntro}>
                        <h2>Send a note</h2>
                        <p>
                            Tell her how to reach you back. No account required.
                        </p>
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
                            {message}{" "}
                            {status === "error" ? (
                                <a href={`mailto:${DEVELOPER_EMAIL}`}>
                                    {DEVELOPER_EMAIL}
                                </a>
                            ) : null}
                        </div>
                    ) : null}

                    <div
                        className={styles.honeypot}
                        aria-hidden="true"
                    >
                        <label htmlFor="website">Website</label>
                        <input
                            id="website"
                            type="text"
                            name="website"
                            tabIndex={-1}
                            autoComplete="off"
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="name">Your name</label>
                        <input
                            key={`name-${defaultName}`}
                            id="name"
                            type="text"
                            name="name"
                            autoComplete="name"
                            placeholder="Ada Lovelace"
                            defaultValue={defaultName}
                            required
                            maxLength={80}
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="email">Your email</label>
                        <input
                            key={`email-${defaultEmail}`}
                            id="email"
                            type="email"
                            name="email"
                            autoComplete="email"
                            inputMode="email"
                            placeholder="you@university.edu"
                            defaultValue={defaultEmail}
                            required
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="topic">What&apos;s this about?</label>
                        <select id="topic" name="topic" defaultValue="Question">
                            {CONTACT_TOPICS.map((topic) => (
                                <option key={topic} value={topic}>
                                    {topic}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="message">Note</label>
                        <textarea
                            id="message"
                            name="message"
                            rows={5}
                            maxLength={1500}
                            placeholder="What's on your mind?"
                            required
                            minLength={8}
                        />
                    </div>

                    <button
                        type="submit"
                        className={styles.submit}
                        disabled={loading}
                    >
                        {loading ? "Sending…" : "Send to Meredith"}
                    </button>

                    <p className={styles.footnote}>
                        Prefer to browse first?{" "}
                        <Link href="/about">See how it works</Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default ContactPage;
