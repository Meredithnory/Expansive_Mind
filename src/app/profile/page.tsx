"use client";

import { useState } from "react";
import ProfileMark from "../components/ProfileMark";
import {
    DEFAULT_PROFILE_COLOR,
    PROFILE_COLORS,
    type ProfileColor,
} from "../lib/profile-colors";
import { useSession } from "../lib/use-session";
import styles from "./profile.module.scss";

export default function ProfilePage() {
    const { user, refresh } = useSession();
    const [saving, setSaving] = useState<ProfileColor | null>(null);
    const [error, setError] = useState("");
    const [picked, setPicked] = useState<ProfileColor | null>(null);

    if (!user) {
        return <main className={styles.page} aria-busy="true" />;
    }

    const current = picked ?? user.profileColor ?? DEFAULT_PROFILE_COLOR;

    async function choose(color: ProfileColor) {
        if (color === current || saving) return;
        const previous = current;
        setPicked(color);
        setSaving(color);
        setError("");
        try {
            const response = await fetch("/api/account/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ profileColor: color }),
            });
            if (!response.ok) throw new Error();
            await refresh();
        } catch {
            setPicked(previous);
            setError("That color didn't save. Please try again.");
        } finally {
            setSaving(null);
        }
    }

    return (
        <main className={styles.page}>
            <section className={styles.card}>
                <div className={styles.identity}>
                    <ProfileMark color={current} size={72} />
                    <div>
                        <h1>Welcome, {user.firstName}</h1>
                        <p className={styles.email}>{user.email}</p>
                    </div>
                </div>

                <div className={styles.picker}>
                    <h2 id="profile-color-label">Your color</h2>
                    <div
                        className={styles.swatches}
                        role="radiogroup"
                        aria-labelledby="profile-color-label"
                    >
                        {PROFILE_COLORS.map((color) => (
                            <button
                                key={color.id}
                                type="button"
                                role="radio"
                                aria-checked={current === color.id}
                                aria-label={color.label}
                                className={styles.swatch}
                                onClick={() => void choose(color.id)}
                            >
                                <ProfileMark color={color.id} size={44} />
                            </button>
                        ))}
                    </div>
                    <p className={styles.status} role="status">
                        {error || (saving ? "Saving…" : "")}
                    </p>
                </div>
            </section>
        </main>
    );
}
