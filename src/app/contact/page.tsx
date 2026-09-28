"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import ResearchOrbit from "../components/ResearchOrbit";
import {
    CONTACT_TOPICS,
    DEVELOPER_EMAIL,
    DEVELOPER_NAME,
    parseContactFields,
    type ContactTopic,
} from "../lib/contact";
import { useSession } from "../lib/use-session";
import styles from "./contact.module.scss";

const MAX_NOTE = 1500;

const ArrowIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const CheckIcon = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const ContactPage = () => {
    const { user } = useSession();
    const firstName = DEVELOPER_NAME.split(" ")[0];
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [topic, setTopic] = useState<ContactTopic>("Question");
    const [note, setNote] = useState("");
    const [touched, setTouched] = useState(false);
    const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Signed-in visitors start with their name and email filled in.
    useEffect(() => {
        if (!user) return;
        setName((current) => current || `${user.firstName} ${user.lastName}`.trim());
        setEmail((current) => current || user.email || "");
    }, [user]);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 1800);
        return () => window.clearTimeout(timer);
    }, [copied]);

    const check = parseContactFields({ name, email, topic, message: note });
    const hint = !check.ok && touched ? check.error : "";

    const copyEmail = async () => {
        try {
            await navigator.clipboard.writeText(DEVELOPER_EMAIL);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    const startOver = () => {
        setNote("");
        setTopic("Question");
        setTouched(false);
        setStatus("idle");
        setMessage("");
    };

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!check.ok || loading) return;
        setStatus("idle");
        setMessage("");
        setLoading(true);

        const formData = new FormData(event.currentTarget);
        const payload = {
            name,
            email,
            topic,
            message: note,
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
                const mailto =
                    typeof data.mailto === "string" &&
                    data.mailto.startsWith(`mailto:${DEVELOPER_EMAIL}`)
                        ? data.mailto
                        : `mailto:${DEVELOPER_EMAIL}`;
                window.location.href = mailto;
                setStatus("success");
                setMessage(
                    "Your email app should open with the note addressed to Meredith.",
                );
            } else {
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
            <ResearchOrbit />

            <div className={styles.card}>
                <aside className={styles.welcome}>
                    <p className={styles.eyebrow}>A human on the other end</p>
                    <h1>Say hello to {firstName}</h1>
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
                                data-copied={copied || undefined}
                                onClick={copyEmail}
                            >
                                {copied ? <CheckIcon /> : null}
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>
                    </div>
                </aside>

                <section
                    className={styles.formPane}
                    aria-labelledby="contact-note-title"
                >
                    {status === "success" ? (
                        <div className={styles.sent} role="status">
                            <span className={styles.sentMark}>
                                <CheckIcon size={28} />
                            </span>
                            <h2 id="contact-note-title">{message}</h2>
                            <div className={styles.sentActions}>
                                <button
                                    type="button"
                                    className={styles.againButton}
                                    onClick={startOver}
                                >
                                    Send another note
                                </button>
                                <Link href="/about" className={styles.aboutButton}>
                                    See how it works
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <form className={styles.form} onSubmit={handleSubmit} noValidate>
                            <div className={styles.formIntro}>
                                <h2 id="contact-note-title">Send a note</h2>
                                <p>
                                    Tell her how to reach you back. No account
                                    required.
                                </p>
                            </div>

                            {status === "error" ? (
                                <div className={styles.errorBanner} role="alert">
                                    {message}{" "}
                                    <a href={`mailto:${DEVELOPER_EMAIL}`}>
                                        {DEVELOPER_EMAIL}
                                    </a>
                                </div>
                            ) : null}

                            <div className={styles.honeypot} aria-hidden="true">
                                <label htmlFor="website">Website</label>
                                <input
                                    id="website"
                                    type="text"
                                    name="website"
                                    tabIndex={-1}
                                    autoComplete="off"
                                />
                            </div>

                            <div className={styles.row}>
                                <div className={styles.field}>
                                    <label htmlFor="name">Your name</label>
                                    <input
                                        id="name"
                                        type="text"
                                        name="name"
                                        autoComplete="name"
                                        placeholder="Ada Lovelace"
                                        value={name}
                                        onChange={(event) => {
                                            setName(event.target.value);
                                            setTouched(true);
                                        }}
                                        required
                                        maxLength={80}
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label htmlFor="email">Your email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        name="email"
                                        autoComplete="email"
                                        inputMode="email"
                                        placeholder="you@university.edu"
                                        value={email}
                                        onChange={(event) => {
                                            setEmail(event.target.value);
                                            setTouched(true);
                                        }}
                                        required
                                    />
                                </div>
                            </div>

                            <fieldset className={styles.topics}>
                                <legend>What&apos;s this about?</legend>
                                <div className={styles.topicOptions}>
                                    {CONTACT_TOPICS.map((option) => (
                                        <label key={option} className={styles.topic}>
                                            <input
                                                type="radio"
                                                name="topic"
                                                value={option}
                                                checked={topic === option}
                                                onChange={() => setTopic(option)}
                                            />
                                            <span>{option}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            <div className={styles.field}>
                                <label htmlFor="message">Note</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    rows={5}
                                    maxLength={MAX_NOTE}
                                    placeholder="What's on your mind?"
                                    value={note}
                                    onChange={(event) => {
                                        setNote(event.target.value);
                                        setTouched(true);
                                    }}
                                    aria-describedby="contact-note-count"
                                    required
                                    minLength={8}
                                />
                                <span id="contact-note-count" className={styles.count}>
                                    {note.length.toLocaleString("en-US")} /{" "}
                                    {MAX_NOTE.toLocaleString("en-US")}
                                </span>
                            </div>

                            <div className={styles.submitRow}>
                                <p className={styles.footnote}>
                                    Prefer to browse first?{" "}
                                    <Link href="/about">See how it works</Link>
                                </p>
                                <button
                                    type="submit"
                                    className={styles.submit}
                                    disabled={!check.ok || loading}
                                    aria-describedby="contact-hint"
                                >
                                    {loading ? "Sending…" : `Send to ${firstName}`}
                                    <span className={styles.submitArrow}>
                                        <ArrowIcon />
                                    </span>
                                </button>
                            </div>
                            {/* Always mounted so screen readers hear it change. */}
                            <p id="contact-hint" className={styles.hint} aria-live="polite">
                                {hint}
                            </p>
                        </form>
                    )}
                </section>
            </div>
        </div>
    );
};

export default ContactPage;
