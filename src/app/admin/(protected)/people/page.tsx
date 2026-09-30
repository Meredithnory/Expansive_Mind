"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { adminApi, postJson } from "../../admin-api";
import { adminUsageCells } from "../../AdminUserUsage";
import { QUOTA_LABELS } from "../../../lib/quota-period";
import styles from "../../admin-portal.module.scss";

type Person = {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    effectivePlan: string;
    accessOverride?: string | null;
    subscriptionStatus: string;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    submittedAt?: string;
    signupSource?: string;
    productEmailOptIn?: boolean;
    usage: unknown;
};

type AuditEntry = { _id: string; adminEmail: string; action: string; createdAt: string };

type Action =
    | "send_password_reset"
    | "revoke_sessions"
    | "grant_pro"
    | "revoke_pro"
    | "reset_usage"
    | "refund_latest"
    | "cancel_subscription"
    | "remove_user";

const ACTION_COPY: Record<Action, { label: string; confirm: (p: Person) => string; done: (p: Person) => string }> = {
    send_password_reset: {
        label: "Send password reset link",
        confirm: (p) => `Send a reset link to ${p.email}?`,
        done: (p) => `Reset link sent to ${p.email}.`,
    },
    revoke_sessions: {
        label: "Sign them out everywhere",
        confirm: (p) => `Sign ${p.firstName} out on every device?`,
        done: (p) => `${p.firstName} is signed out everywhere.`,
    },
    grant_pro: {
        label: "Grant Pro",
        confirm: (p) => `Give ${p.firstName} complimentary Pro?`,
        done: (p) => `${p.firstName} has complimentary Pro.`,
    },
    revoke_pro: {
        label: "Remove complimentary Pro",
        confirm: (p) => `Remove ${p.firstName}'s complimentary Pro?`,
        done: (p) => `Complimentary Pro removed for ${p.firstName}.`,
    },
    reset_usage: {
        label: "Reset usage",
        confirm: (p) => `Reset every usage counter for ${p.firstName}?`,
        done: (p) => `Usage reset for ${p.firstName}.`,
    },
    refund_latest: {
        label: "Refund latest charge",
        confirm: (p) => `Refund ${p.firstName}'s latest charge in Stripe?`,
        done: (p) => `Latest charge refunded for ${p.firstName}.`,
    },
    cancel_subscription: {
        label: "Cancel renewal",
        confirm: (p) => `Cancel ${p.firstName}'s renewal at the end of this period?`,
        done: (p) => `${p.firstName}'s subscription won't renew.`,
    },
    remove_user: {
        label: "Remove account",
        confirm: (p) => `Type ${p.email} to remove this account.`,
        done: (p) => `${p.email} was removed.`,
    },
};

const ACTION_AUDIT: Record<string, string> = {
    "user.send_password_reset": "Password reset link sent",
    "user.revoke_sessions": "Signed out everywhere",
    "user.grant_pro": "Complimentary Pro granted",
    "user.revoke_pro": "Complimentary Pro removed",
    "user.reset_usage": "Usage reset",
    "user.refund_latest": "Latest charge refunded",
    "user.cancel_subscription": "Renewal canceled",
    "email.send": "Emailed",
};

function initials(person: Person) {
    return `${person.firstName?.[0] ?? ""}${person.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function day(value?: string) {
    return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
}

export default function AdminPeoplePage() {
    const [query, setQuery] = useState("");
    const [people, setPeople] = useState<Person[] | null>(null);
    const [selected, setSelected] = useState<Person | null>(null);
    const [history, setHistory] = useState<AuditEntry[]>([]);
    const [pending, setPending] = useState<Action | null>(null);
    const [typed, setTyped] = useState("");
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

    const search = useCallback(async (q: string, keepId?: string) => {
        try {
            const data = await adminApi<{ users: Person[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`);
            const users = data.users ?? [];
            setPeople(users);
            setSelected((current) => {
                const id = keepId ?? current?._id;
                return users.find((person) => person._id === id) ?? users[0] ?? null;
            });
        } catch (err) {
            setNotice({ kind: "error", text: err instanceof Error ? err.message : "Search failed." });
        }
    }, []);

    useEffect(() => {
        search("");
    }, [search]);

    useEffect(() => {
        setPending(null);
        setTyped("");
        if (!selected) return;
        adminApi<{ entries: AuditEntry[] }>(`/api/admin/audit?target=user:${selected._id}`)
            .then((data) => setHistory(data.entries))
            .catch(() => setHistory([]));
    }, [selected]);

    const onSearch = (event: FormEvent) => {
        event.preventDefault();
        setNotice(null);
        search(query);
    };

    const run = async (action: Action) => {
        if (!selected) return;
        setBusy(true);
        setNotice(null);
        try {
            await adminApi("/api/admin/users/actions", postJson("POST", {
                userId: selected._id,
                action,
                confirm: action,
            }));
            setNotice({ kind: "ok", text: ACTION_COPY[action].done(selected) });
            setPending(null);
            setTyped("");
            if (action === "remove_user") {
                setSelected(null);
                await search(query);
            } else {
                await search(query, selected._id);
                const data = await adminApi<{ entries: AuditEntry[] }>(`/api/admin/audit?target=user:${selected._id}`);
                setHistory(data.entries);
            }
        } catch (err) {
            setNotice({ kind: "error", text: err instanceof Error ? err.message : "That didn't work." });
        } finally {
            setBusy(false);
        }
    };

    const actionButton = (action: Action, tone: "primary" | "plain" | "danger" = "plain") => (
        <button
            type="button"
            className={clsx(styles.actionButton, {
                [styles.actionPrimary]: tone === "primary",
                [styles.actionDanger]: tone === "danger",
            })}
            disabled={busy}
            aria-expanded={pending === action}
            onClick={() => {
                setNotice(null);
                setTyped("");
                setPending(pending === action ? null : action);
            }}
        >
            {ACTION_COPY[action].label}
        </button>
    );

    const confirmBox = (action: Action) =>
        pending === action && selected ? (
            <div className={styles.confirm} role="alertdialog" aria-labelledby={`confirm-${action}`}>
                <span id={`confirm-${action}`}>{ACTION_COPY[action].confirm(selected)}</span>
                {action === "remove_user" ? (
                    <input
                        className={styles.input}
                        value={typed}
                        onChange={(event) => setTyped(event.target.value)}
                        aria-label="Their email, to confirm"
                        placeholder={selected.email}
                        autoComplete="off"
                    />
                ) : null}
                <div className={styles.confirmActions}>
                    <button
                        type="button"
                        className={clsx(styles.actionButton, action === "remove_user" ? styles.actionDanger : styles.actionPrimary)}
                        disabled={busy || (action === "remove_user" && typed.trim().toLowerCase() !== selected.email.toLowerCase())}
                        onClick={() => run(action)}
                    >
                        {busy ? "Working…" : action === "send_password_reset" ? "Send link" : "Confirm"}
                    </button>
                    <button type="button" className={styles.actionButton} onClick={() => setPending(null)}>
                        Cancel
                    </button>
                </div>
            </div>
        ) : null;

    const usage = selected ? adminUsageCells(selected.usage) : [];
    const comp = selected?.accessOverride === "pro";

    return (
        <main className={styles.main}>
            <header className={styles.pageHeader}>
                <div>
                    <p className={styles.eyebrow}>Admin</p>
                    <h1>People &amp; support</h1>
                </div>
            </header>

            <div className={styles.peopleLayout}>
                <div className={styles.peopleList}>
                    <form onSubmit={onSearch} className={styles.searchForm} role="search">
                        <label htmlFor="find-person" className={styles.label}>
                            Find a person
                        </label>
                        <div className={styles.searchRow}>
                            <input
                                id="find-person"
                                type="search"
                                className={styles.input}
                                placeholder="Email or name"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                            <button type="submit" className={styles.actionButton}>
                                Search
                            </button>
                        </div>
                    </form>
                    {!people ? (
                        <div className={clsx(styles.skeletonBlock, "loading-skeleton")} />
                    ) : people.length === 0 ? (
                        <p className={styles.muted}>Nobody matches that.</p>
                    ) : (
                        <ul className={styles.plainList}>
                            {people.map((person) => (
                                <li key={person._id}>
                                    <button
                                        type="button"
                                        className={clsx(styles.personRow, {
                                            [styles.personRowActive]: selected?._id === person._id,
                                        })}
                                        aria-current={selected?._id === person._id ? "true" : undefined}
                                        onClick={() => setSelected(person)}
                                    >
                                        <span className={styles.avatar}>{initials(person)}</span>
                                        <span className={styles.personText}>
                                            <strong>
                                                {person.firstName} {person.lastName}
                                            </strong>
                                            <small>{person.email}</small>
                                        </span>
                                        <span className={clsx(styles.planChip, { [styles.planChipPro]: person.effectivePlan === "pro" })}>
                                            {person.effectivePlan === "pro" ? "Pro" : "Free"}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className={styles.personDetail}>
                    {notice ? (
                        <p className={notice.kind === "ok" ? styles.success : styles.error} role="status">
                            {notice.text}
                        </p>
                    ) : null}
                    {!selected ? (
                        <p className={styles.muted}>Pick someone to see their account.</p>
                    ) : (
                        <>
                            <section className={styles.card}>
                                <div className={styles.personHead}>
                                    <span className={clsx(styles.avatar, styles.avatarLarge)}>{initials(selected)}</span>
                                    <div>
                                        <h2>
                                            {selected.firstName} {selected.lastName}
                                        </h2>
                                        <span className={styles.muted}>{selected.email}</span>
                                    </div>
                                </div>
                                <div className={styles.chips}>
                                    <span className={styles.chip}>
                                        {selected.effectivePlan === "pro" ? (comp ? "Complimentary Pro" : "Pro") : "Free plan"}
                                    </span>
                                    {selected.subscriptionStatus && selected.subscriptionStatus !== "none" ? (
                                        <span className={styles.chip}>Subscription {selected.subscriptionStatus}</span>
                                    ) : null}
                                    {selected.submittedAt ? <span className={styles.chip}>Joined {day(selected.submittedAt)}</span> : null}
                                    {selected.signupSource === "brief" ? <span className={styles.chip}>Joined from a shared brief</span> : null}
                                    <span className={styles.chip}>
                                        {selected.productEmailOptIn ? "Gets product email" : "No product email"}
                                    </span>
                                </div>
                            </section>

                            <div className={styles.twoUp}>
                                <section className={styles.card} aria-labelledby="signin-h">
                                    <h2 id="signin-h">Sign-in help</h2>
                                    <p className={styles.muted}>For someone who is locked out. Every action here goes in the audit log.</p>
                                    {actionButton("send_password_reset", "primary")}
                                    {confirmBox("send_password_reset")}
                                    <span className={styles.footnote}>
                                        Sends the same email as Forgot password. The link works once and expires in one hour.
                                    </span>
                                    <div className={styles.divider} />
                                    {actionButton("revoke_sessions")}
                                    {confirmBox("revoke_sessions")}
                                    <span className={styles.footnote}>Ends every session on every device.</span>
                                </section>

                                <section className={styles.card} aria-labelledby="usage-h">
                                    <h2 id="usage-h">Usage this period</h2>
                                    {usage.length === 0 ? (
                                        <p className={styles.muted}>No usage recorded.</p>
                                    ) : (
                                        usage.map((cell) => {
                                            const label =
                                                QUOTA_LABELS[cell.feature as keyof typeof QUOTA_LABELS] ?? cell.feature.replaceAll("_", " ");
                                            const share = cell.limit > 0 ? Math.min(100, (cell.used / cell.limit) * 100) : 0;
                                            return (
                                                <div key={cell.feature} className={styles.usageRow}>
                                                    <span className={styles.usageLabel}>
                                                        <strong>{label}</strong>
                                                        <span>
                                                            {cell.used} of {cell.limit}
                                                        </span>
                                                    </span>
                                                    <span className={styles.bar}>
                                                        <span style={{ width: `${share}%` }} />
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                    <span className={styles.footnote}>
                                        Limits come from their plan. Change them under <Link href="/admin/billing">Billing &amp; pricing</Link>.
                                    </span>
                                </section>
                            </div>

                            <div className={styles.twoUp}>
                                <section className={styles.card} aria-labelledby="plan-h">
                                    <h2 id="plan-h">Plan and billing</h2>
                                    <div className={styles.actionWrap}>
                                        {comp ? actionButton("revoke_pro") : actionButton("grant_pro")}
                                        {actionButton("reset_usage")}
                                        {selected.stripeCustomerId ? actionButton("refund_latest") : null}
                                        {selected.stripeSubscriptionId ? actionButton("cancel_subscription") : null}
                                    </div>
                                    {confirmBox("grant_pro")}
                                    {confirmBox("revoke_pro")}
                                    {confirmBox("reset_usage")}
                                    {confirmBox("refund_latest")}
                                    {confirmBox("cancel_subscription")}
                                </section>
                                <section className={styles.card} aria-labelledby="contact-h">
                                    <h2 id="contact-h">Contact</h2>
                                    <Link href={`/admin/email?to=${selected._id}`} className={clsx(styles.actionButton, styles.actionWide)}>
                                        Email {selected.firstName}
                                    </Link>
                                    <span className={styles.footnote}>Opens Email with this person filled in.</span>
                                </section>
                            </div>

                            <section className={styles.card} aria-labelledby="history-h">
                                <div className={styles.cardHead}>
                                    <h2 id="history-h">History</h2>
                                    <Link href="/admin/audit" className={styles.textLink}>
                                        Full audit log
                                    </Link>
                                </div>
                                <ul className={styles.plainList}>
                                    {history.map((entry) => (
                                        <li key={entry._id} className={styles.historyRow}>
                                            <span className={styles.when}>{new Date(entry.createdAt).toLocaleString()}</span>
                                            <span>
                                                {ACTION_AUDIT[entry.action] ?? entry.action} by {entry.adminEmail}
                                            </span>
                                        </li>
                                    ))}
                                    {selected.submittedAt ? (
                                        <li className={styles.historyRow}>
                                            <span className={styles.when}>{day(selected.submittedAt)}</span>
                                            <span>Signed up</span>
                                        </li>
                                    ) : null}
                                </ul>
                            </section>

                            <section className={clsx(styles.card, styles.dangerCard)} aria-labelledby="remove-h">
                                <div className={styles.cardHead}>
                                    <div>
                                        <h2 id="remove-h">Remove this account</h2>
                                        <p className={styles.muted}>
                                            Deletes their library, discoveries, chats, projects, and share links, and cancels any subscription.
                                        </p>
                                    </div>
                                    {actionButton("remove_user", "danger")}
                                </div>
                                {confirmBox("remove_user")}
                            </section>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
