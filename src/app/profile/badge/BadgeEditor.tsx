"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import LabCharacter from "../../components/LabCharacter";
import {
    BADGE_ROLES,
    BADGE_SLOTS,
    BADGE_SLOT_LABELS,
    BADGE_SLOT_ORDER,
    BIO_MAX,
    EMPTY_BADGE,
    FIELD_MAX,
    type Badge,
    type BadgeSlot,
} from "../../lib/lab-badge";
import { DEFAULT_PROFILE_COLOR, PROFILE_COLORS, type ProfileColor } from "../../lib/profile-colors";
import { useSession } from "../../lib/use-session";
import BadgeStage, { NameTag, tagName } from "../BadgeStage";
import ExtraIcon from "./ExtraIcon";
import styles from "../profile.module.scss";

type Tab = "coat" | "tag" | "extras";
const TABS: Array<{ id: Tab; label: string }> = [
    { id: "coat", label: "Coat" },
    { id: "tag", label: "Name tag" },
    { id: "extras", label: "Extras" },
];

/** How long the "Badge saved" pop-up shows before going to the profile. */
const SAVED_REDIRECT_MS = 1800;

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

export default function BadgeEditor() {
    const { user, refresh } = useSession();
    const router = useRouter();
    const params = useSearchParams();
    const savedButton = useRef<HTMLButtonElement>(null);
    const requestedTab = params.get("tab");
    const [tab, setTab] = useState<Tab>(
        requestedTab === "tag" || requestedTab === "extras" ? requestedTab : "coat",
    );
    const [color, setColor] = useState<ProfileColor>(DEFAULT_PROFILE_COLOR);
    const [badge, setBadge] = useState<Badge>(EMPTY_BADGE);
    const [bio, setBio] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [hop, setHop] = useState(0);
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [error, setError] = useState("");

    // After a save: show the pop-up, then go to the profile.
    useEffect(() => {
        if (status !== "saved") return;
        savedButton.current?.focus();
        const timer = window.setTimeout(() => router.push("/profile"), SAVED_REDIRECT_MS);
        return () => window.clearTimeout(timer);
    }, [status, router]);

    // Start from what's saved, once the session arrives.
    useEffect(() => {
        if (!user || loaded) return;
        setColor(user.profileColor ?? DEFAULT_PROFILE_COLOR);
        setBadge(user.badge ?? EMPTY_BADGE);
        setBio(user.bio ?? "");
        setLoaded(true);
    }, [user, loaded]);

    if (!user) {
        return <main className={styles.page} aria-busy="true" />;
    }

    const name = tagName(user.firstName, user.lastName);
    const edited = () => setStatus("idle");
    // Only a wardrobe change (coat or extras) makes the character jump.
    const dress = (next: { color?: ProfileColor; badge?: Partial<Badge> }) => {
        if (next.color) setColor(next.color);
        if (next.badge) setBadge((current) => ({ ...current, ...next.badge }));
        setHop((value) => value + 1);
        edited();
    };
    const surprise = () => {
        const outfit: Partial<Badge> = {};
        for (const slot of BADGE_SLOT_ORDER) {
            const options: ReadonlyArray<{ id: string }> = BADGE_SLOTS[slot];
            (outfit as Record<BadgeSlot, string>)[slot] = pick(options).id;
        }
        dress({ color: pick(PROFILE_COLORS).id, badge: outfit });
    };

    async function save() {
        setStatus("saving");
        setError("");
        try {
            const response = await fetch("/api/account/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ profileColor: color, badge, bio }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Your badge didn't save.");
            await refresh();
            setStatus("saved");
        } catch (err) {
            setStatus("error");
            setError(err instanceof Error ? err.message : "Your badge didn't save.");
        }
    }

    const saveLabel =
        status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save badge";

    return (
        <main className={styles.page}>
            <header className={styles.editorHeader}>
                <div>
                    <Link href="/profile" className={styles.back}>
                        ← Profile
                    </Link>
                    <h1>Your lab badge</h1>
                    <p className={styles.muted}>
                        Pick your coat and fill in your name tag. This is how you show up on posts,
                        comments, and groups.
                    </p>
                </div>
                <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void save()}
                    disabled={status === "saving" || !loaded}
                >
                    {saveLabel}
                </button>
            </header>
            {status === "error" && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}

            <div className={styles.editor}>
                <div className={styles.editorStage}>
                    <BadgeStage
                        color={color}
                        badge={badge}
                        label={`${name}'s character`}
                        greeting={`Hi, I’m ${user.firstName || "new here"}!`}
                        hop={hop}
                    >
                        <NameTag color={color} name={name} role={badge.role} field={badge.field} />
                    </BadgeStage>
                </div>

                <section className={`${styles.panel} ${styles.controls}`} aria-label="Badge settings">
                    <div className={styles.tabs} role="tablist" aria-label="Badge settings">
                        {TABS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                aria-selected={tab === item.id}
                                className={tab === item.id ? styles.tabActive : styles.tab}
                                onClick={() => setTab(item.id)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {tab === "coat" && (
                        <div className={styles.controlGroup}>
                            <div>
                                <h2>Coat color</h2>
                                <p className={styles.muted}>Your coat color also rings your avatar next to everything you post.</p>
                            </div>
                            <div className={styles.coats} role="radiogroup" aria-label="Coat color">
                                {PROFILE_COLORS.map((coat) => (
                                    <button
                                        key={coat.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={color === coat.id}
                                        className={styles.coat}
                                        onClick={() => dress({ color: coat.id })}
                                    >
                                        <span className={color === coat.id ? styles.coatSwatchActive : styles.coatSwatch}>
                                            <svg width="46" height="46" viewBox="0 0 58 58" aria-hidden="true" focusable="false">
                                                <path d="M6 58 C6 36 12 24 22 19 L36 19 C46 24 52 36 52 58 Z" fill={coat.hex} />
                                                <path d="M23 19 L29 31 L35 19 Z" fill="#15151c" />
                                                <path d="M23 19 L29 31 L26 44 L17 23 Z" fill={coat.shade} />
                                                <path d="M35 19 L29 31 L32 44 L41 23 Z" fill={coat.shade} />
                                                <rect x="36" y="38" width="10" height="6" rx="1.5" fill="#f7f4ee" />
                                            </svg>
                                        </span>
                                        <span className={styles.coatLabel}>{coat.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === "tag" && (
                        <div className={styles.controlGroup}>
                            <div className={styles.fieldRow}>
                                <span className={styles.fieldLabel} id="role-label">
                                    Role
                                </span>
                                <div className={styles.roles} role="radiogroup" aria-labelledby="role-label">
                                    {BADGE_ROLES.map((role) => (
                                        <button
                                            key={role}
                                            type="button"
                                            role="radio"
                                            aria-checked={badge.role === role}
                                            className={badge.role === role ? styles.chipActive : styles.chip}
                                            onClick={() => {
                                                setBadge((current) => ({
                                                    ...current,
                                                    role: current.role === role ? null : role,
                                                }));
                                                edited();
                                            }}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <label className={styles.fieldRow}>
                                <span className={styles.fieldLabel}>Field</span>
                                <input
                                    type="text"
                                    value={badge.field}
                                    maxLength={FIELD_MAX}
                                    placeholder="e.g. Immunology"
                                    onChange={(event) => {
                                        const field = event.target.value;
                                        setBadge((current) => ({ ...current, field }));
                                        edited();
                                    }}
                                />
                            </label>
                            <label className={styles.fieldRow}>
                                <span className={styles.fieldLabel}>
                                    Bio <span className={styles.muted}>({bio.length}/{BIO_MAX})</span>
                                </span>
                                <textarea
                                    value={bio}
                                    maxLength={BIO_MAX}
                                    rows={3}
                                    placeholder="What you work on, or what you're reading lately"
                                    onChange={(event) => {
                                        setBio(event.target.value);
                                        edited();
                                    }}
                                />
                            </label>
                            <p className={styles.muted}>
                                Your name tag shows {name}, from your account. Role, field, and bio are
                                public on your forum profile.
                            </p>
                        </div>
                    )}

                    {tab === "extras" && (
                        <div className={styles.controlGroup}>
                            <div className={styles.extrasHeader}>
                                <div>
                                    <h2>Extras</h2>
                                    <p className={styles.muted}>One per slot. Mix and match.</p>
                                </div>
                                <button type="button" className={styles.surprise} onClick={surprise}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" />
                                        <circle cx="8.5" cy="8.5" r="1.6" fill="currentColor" />
                                        <circle cx="15.5" cy="15.5" r="1.6" fill="currentColor" />
                                        <circle cx="15.5" cy="8.5" r="1.6" fill="currentColor" />
                                        <circle cx="8.5" cy="15.5" r="1.6" fill="currentColor" />
                                    </svg>
                                    Surprise me
                                </button>
                            </div>
                            {BADGE_SLOT_ORDER.map((slot) => {
                                const current = BADGE_SLOTS[slot].find((item) => item.id === badge[slot]);
                                return (
                                    <div key={slot} className={styles.slotRow}>
                                        <div className={styles.slotLabel}>
                                            <span id={`slot-${slot}`}>{BADGE_SLOT_LABELS[slot]}</span>
                                            <span className={badge[slot] === "none" ? styles.slotNone : styles.slotCurrent}>
                                                {current?.name}
                                            </span>
                                        </div>
                                        <div className={styles.slotOptions} role="radiogroup" aria-labelledby={`slot-${slot}`}>
                                            {BADGE_SLOTS[slot].map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={badge[slot] === item.id}
                                                    aria-label={item.name}
                                                    title={item.name}
                                                    className={badge[slot] === item.id ? styles.tileActive : styles.tile}
                                                    onClick={() => dress({ badge: { [slot]: item.id } as Partial<Badge> })}
                                                >
                                                    <ExtraIcon id={item.id} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {status === "saved" && (
                <div className={styles.savedBackdrop}>
                    <div
                        className={styles.savedModal}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="badge-saved-title"
                        aria-describedby="badge-saved-text"
                    >
                        <span className={styles.savedMark}>
                            <LabCharacter color={color} badge={badge} width={120} crop="portrait" />
                        </span>
                        <h2 id="badge-saved-title">Badge saved!</h2>
                        <p id="badge-saved-text" className={styles.muted}>
                            Taking you to your profile…
                        </p>
                        <button
                            ref={savedButton}
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => router.push("/profile")}
                        >
                            Go to profile
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
