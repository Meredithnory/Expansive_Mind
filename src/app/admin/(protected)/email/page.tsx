"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { adminApi, postJson } from "../../admin-api";
import styles from "../../admin-portal.module.scss";

type Audience = "one" | "pro" | "free" | "new";
type Reach = { all: number; optedIn: number };
type Template = { id: string; name: string; trigger: string; subject: string; html: string };
type SentEmail = {
    _id: string;
    subject: string;
    audience: Audience;
    test: boolean;
    recipients: number;
    sent: number;
    failed: number;
    sentBy: string;
    createdAt: string;
};
/** Set by the API; absent on an older server. */
type Compliance = {
    postalAddressSet: boolean;
    postalAddress?: string | null;
    unsubscribeReady: boolean;
    from: string;
    dailyMax: number;
    sentToday: number;
    remainingToday: number;
};
type EmailData = {
    audiences: Record<Exclude<Audience, "one">, Reach>;
    compliance?: Compliance;
    sent: SentEmail[];
    templates: Template[];
    maxRecipients: number;
    configured: boolean;
};
type Person = { _id: string; firstName: string; lastName: string; email: string };

const AUDIENCES: Array<{ id: Audience; label: string }> = [
    { id: "one", label: "One person" },
    { id: "pro", label: "Everyone on Pro" },
    { id: "free", label: "Everyone on Free" },
    { id: "new", label: "Joined in the last 30 days" },
];

const AUDIENCE_NAME: Record<Audience, string> = {
    one: "One person",
    pro: "Pro",
    free: "Free",
    new: "Joined in 30 days",
};

function EmailPage() {
    const params = useSearchParams();
    const [tab, setTab] = useState<"write" | "sent">("write");
    const [data, setData] = useState<EmailData | null>(null);
    const [error, setError] = useState("");
    const [audience, setAudience] = useState<Audience>("one");
    const [person, setPerson] = useState<Person | null>(null);
    const [find, setFind] = useState("");
    const [matches, setMatches] = useState<Person[]>([]);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
    const [preview, setPreview] = useState<Template | null>(null);

    const load = useCallback(async () => {
        try {
            setData(await adminApi<EmailData>("/api/admin/email"));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to load email.");
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // /admin/email?to=<id> from People fills in the person.
    useEffect(() => {
        const to = params.get("to");
        if (!to || !/^[a-f0-9]{24}$/i.test(to)) return;
        adminApi<{ users: Person[] }>(`/api/admin/users?id=${to}`)
            .then((result) => {
                if (result.users[0]) {
                    setAudience("one");
                    setPerson(result.users[0]);
                }
            })
            .catch(() => undefined);
    }, [params]);

    const searchPeople = async (event: FormEvent) => {
        event.preventDefault();
        const result = await adminApi<{ users: Person[] }>(`/api/admin/users?q=${encodeURIComponent(find)}`).catch(() => ({ users: [] }));
        setMatches(result.users.slice(0, 6));
    };

    const group = audience !== "one";
    const reach = group && data ? data.audiences[audience as Exclude<Audience, "one">] : null;
    // Group email only ever reaches people who agreed to product email.
    const recipients = reach ? reach.optedIn : person ? 1 : 0;
    const compliance = data?.compliance;
    const groupBlocked = Boolean(
        group && compliance && (!compliance.postalAddressSet || !compliance.unsubscribeReady),
    );
    const overCap = Boolean(compliance && recipients > compliance.remainingToday);
    const ready = subject.trim() && body.trim() && recipients > 0 && !groupBlocked && !overCap;

    const send = async (test: boolean) => {
        setBusy(true);
        setNotice(null);
        try {
            const result = await adminApi<{ recipients: number; sent: number; failed: number }>(
                "/api/admin/email",
                postJson("POST", {
                    audience,
                    userId: person?._id,
                    subject,
                    body,
                    test,
                }),
            );
            setNotice({
                kind: result.failed ? "error" : "ok",
                text: test
                    ? "Test sent to you."
                    : `Sent to ${result.sent} of ${result.recipients}${result.failed ? `. ${result.failed} failed.` : "."}`,
            });
            setConfirming(false);
            if (!test) {
                setSubject("");
                setBody("");
            }
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: err instanceof Error ? err.message : "That didn't send." });
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className={styles.main}>
            <header className={styles.pageHeader}>
                <div>
                    <p className={styles.eyebrow}>Admin</p>
                    <h1>Email</h1>
                </div>
                <div role="tablist" aria-label="Email" className={styles.segmented}>
                    <button type="button" role="tab" aria-selected={tab === "write"} onClick={() => setTab("write")}>
                        Write
                    </button>
                    <button type="button" role="tab" aria-selected={tab === "sent"} onClick={() => setTab("sent")}>
                        Sent
                    </button>
                </div>
            </header>

            {error ? <p className={styles.error}>{error}</p> : null}
            {data && !data.configured ? (
                <p className={styles.error}>Email isn&apos;t set up here: RESEND_API_KEY is missing, so nothing can be sent.</p>
            ) : null}
            {notice ? (
                <p className={notice.kind === "ok" ? styles.success : styles.error} role="status">
                    {notice.text}
                </p>
            ) : null}

            {tab === "write" ? (
                <div className={styles.twoUp}>
                    <div className={styles.stack}>
                        <section className={styles.card} aria-label="Write an email">
                            <div className={styles.field}>
                                <span className={styles.label} id="to-label">To</span>
                                <div role="radiogroup" aria-labelledby="to-label" className={styles.pills}>
                                    {AUDIENCES.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={audience === item.id}
                                            className={styles.pill}
                                            onClick={() => {
                                                setAudience(item.id);
                                                setConfirming(false);
                                            }}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                                {group ? (
                                    <span className={styles.muted}>
                                        {reach
                                            ? `${reach.optedIn} of ${reach.all} people agreed to product email. Only they get this.`
                                            : "Counting…"}
                                    </span>
                                ) : person ? (
                                    <span className={styles.personPicked}>
                                        <span>
                                            <strong>
                                                {person.firstName} {person.lastName}
                                            </strong>{" "}
                                            · {person.email}
                                        </span>
                                        <button type="button" className={styles.textButton} onClick={() => setPerson(null)}>
                                            Change
                                        </button>
                                    </span>
                                ) : (
                                    <form className={styles.searchRow} onSubmit={searchPeople} role="search">
                                        <input
                                            type="search"
                                            className={styles.input}
                                            placeholder="Find by email or name"
                                            aria-label="Find the person to email"
                                            value={find}
                                            onChange={(event) => setFind(event.target.value)}
                                        />
                                        <button type="submit" className={styles.actionButton}>
                                            Find
                                        </button>
                                    </form>
                                )}
                                {!group && !person && matches.length > 0 ? (
                                    <ul className={styles.plainList}>
                                        {matches.map((match) => (
                                            <li key={match._id}>
                                                <button type="button" className={styles.personRow} onClick={() => setPerson(match)}>
                                                    <span className={styles.personText}>
                                                        <strong>
                                                            {match.firstName} {match.lastName}
                                                        </strong>
                                                        <small>{match.email}</small>
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </div>

                            {groupBlocked && compliance ? (
                                <p className={styles.warning}>
                                    Group email is off until{" "}
                                    {[
                                        !compliance.postalAddressSet ? "a postal address is set for the footer" : "",
                                        !compliance.unsubscribeReady ? "unsubscribe links are configured" : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" and ")}
                                    . One-person email still works.
                                </p>
                            ) : null}
                            <div className={styles.field}>
                                <span className={styles.label}>From</span>
                                <span>
                                    {group && compliance?.from
                                        ? compliance.from
                                        : "Expansive Mind <support@expansivemind.ai>"}
                                </span>
                                <span className={styles.footnote}>Replies come to your inbox.</span>
                            </div>
                            <label className={styles.field}>
                                <span className={styles.label}>Subject</span>
                                <input
                                    className={styles.input}
                                    value={subject}
                                    maxLength={200}
                                    onChange={(event) => setSubject(event.target.value)}
                                />
                            </label>
                            <label className={styles.field}>
                                <span className={styles.label}>Message</span>
                                <textarea
                                    className={clsx(styles.input, styles.textarea)}
                                    rows={9}
                                    value={body}
                                    maxLength={10000}
                                    onChange={(event) => setBody(event.target.value)}
                                />
                                <span className={styles.footnote}>A blank line starts a new paragraph.</span>
                            </label>

                            {compliance ? (
                                <span className={overCap ? styles.warningText : styles.footnote}>
                                    {compliance.sentToday} of {compliance.dailyMax} emails sent today, password resets
                                    included.
                                    {overCap ? ` This send needs ${recipients}; ${compliance.remainingToday} are left today.` : ""}
                                </span>
                            ) : null}

                            {confirming ? (
                                <div className={styles.confirm} role="alertdialog" aria-labelledby="send-q">
                                    <span id="send-q">
                                        Send “{subject.trim()}” to {recipients} {recipients === 1 ? "person" : "people"}?
                                    </span>
                                    <div className={styles.confirmActions}>
                                        <button
                                            type="button"
                                            className={clsx(styles.actionButton, styles.actionPrimary)}
                                            disabled={busy}
                                            onClick={() => send(false)}
                                        >
                                            {busy ? "Sending…" : "Send now"}
                                        </button>
                                        <button type="button" className={styles.actionButton} onClick={() => setConfirming(false)}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.actionWrap}>
                                    <button
                                        type="button"
                                        className={styles.actionButton}
                                        disabled={busy || !subject.trim() || !body.trim()}
                                        onClick={() => send(true)}
                                    >
                                        Send a test to me
                                    </button>
                                    <button
                                        type="button"
                                        className={clsx(styles.actionButton, styles.actionPrimary, styles.pushRight)}
                                        disabled={busy || !ready || !data?.configured}
                                        onClick={() => setConfirming(true)}
                                    >
                                        {group ? `Send to ${recipients} ${recipients === 1 ? "person" : "people"}` : "Send"}
                                    </button>
                                </div>
                            )}
                        </section>

                        <section className={styles.card} aria-labelledby="auto-h">
                            <h2 id="auto-h">Automatic emails</h2>
                            <ul className={styles.plainList}>
                                {(data?.templates ?? []).map((template) => (
                                    <li key={template.id} className={styles.templateRow}>
                                        <span className={styles.qualityText}>
                                            <strong>{template.name}</strong>
                                            <small>{template.trigger}</small>
                                        </span>
                                        <span className={styles.liveChip}>Live</span>
                                        <button type="button" className={styles.textButton} onClick={() => setPreview(template)}>
                                            Preview
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>

                    <div className={styles.stack}>
                        <span className={styles.label}>Preview</span>
                        <div className={styles.emailPreview}>
                            <div className={styles.emailBrand}>
                                <Image src="/brainlogo.svg" alt="Expansive Mind logo" width={36} height={36} />
                                <span>Expansive Mind</span>
                            </div>
                            <span className={styles.emailEyebrow}>From Expansive Mind</span>
                            <h2>{subject.trim() || "Your subject"}</h2>
                            <div className={styles.emailBody}>
                                {(body.trim() || "Your message.").split(/\n\s*\n/).map((paragraph, index) => (
                                    <p key={index}>{paragraph}</p>
                                ))}
                            </div>
                            <div className={styles.emailFooter}>
                                {group ? (
                                    <span>
                                        You get this because you agreed to product email from Expansive Mind.{" "}
                                        <u>Unsubscribe</u>
                                        <br />
                                        {compliance?.postalAddress || "[Postal address]"}
                                    </span>
                                ) : (
                                    <span>Sent by the Expansive Mind team. Reply to this email to reach us.</span>
                                )}
                                <span>© {new Date().getFullYear()} Expansive Mind. All rights reserved.</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <section className={styles.card} aria-label="Sent email">
                    {!data ? (
                        <div className={clsx(styles.skeletonBlock, "loading-skeleton")} />
                    ) : data.sent.length === 0 ? (
                        <p className={styles.muted}>Nothing sent yet.</p>
                    ) : (
                        <ul className={styles.plainList}>
                            {data.sent.map((email) => (
                                <li key={email._id} className={styles.sentRow}>
                                    <span className={styles.qualityText}>
                                        <strong>{email.subject}</strong>
                                        <small>
                                            {email.test ? "Test to you" : AUDIENCE_NAME[email.audience]} · by {email.sentBy}
                                        </small>
                                    </span>
                                    <span className={styles.muted}>
                                        {email.sent} of {email.recipients} sent{email.failed ? `, ${email.failed} failed` : ""}
                                    </span>
                                    <span className={styles.when}>{new Date(email.createdAt).toLocaleString()}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {preview ? (
                <div className={styles.modalBackdrop} role="presentation" onClick={() => setPreview(null)}>
                    <div
                        className={styles.modal}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="preview-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className={styles.cardHead}>
                            <div>
                                <h2 id="preview-title">{preview.name}</h2>
                                <span className={styles.muted}>Subject: {preview.subject}</span>
                            </div>
                            <button type="button" className={styles.actionButton} onClick={() => setPreview(null)} autoFocus>
                                Close
                            </button>
                        </div>
                        <iframe title={`${preview.name} preview`} srcDoc={preview.html} sandbox="" className={styles.previewFrame} />
                    </div>
                </div>
            ) : null}
        </main>
    );
}

export default function AdminEmailPage() {
    return (
        <Suspense fallback={<main className={styles.main} />}>
            <EmailPage />
        </Suspense>
    );
}
