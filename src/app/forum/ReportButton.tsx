"use client";

import { useState } from "react";
import { FORUM_REPORT_REASONS } from "../lib/forum";
import { send } from "./forum-client";
import styles from "./forum.module.scss";

export default function ReportButton({
    targetType,
    targetId,
    signedIn,
}: {
    targetType: "post" | "comment";
    targetId: string;
    signedIn: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [done, setDone] = useState("");

    if (!signedIn) return null;
    if (done) return <span className={styles.reported}>{done}</span>;

    return (
        <span className={styles.reportWrap}>
            <button
                type="button"
                className={styles.quiet}
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
            >
                Report
            </button>
            {open && (
                <span className={styles.reportMenu} role="menu">
                    {FORUM_REPORT_REASONS.map((reason) => (
                        <button
                            key={reason.id}
                            type="button"
                            role="menuitem"
                            onClick={() =>
                                void send("/api/forum/report", "POST", {
                                    targetType,
                                    targetId,
                                    reason: reason.id,
                                })
                                    .then(() => setDone("Reported. Thanks, we'll take a look."))
                                    .catch((err) => setDone(err.message))
                            }
                        >
                            {reason.label}
                        </button>
                    ))}
                </span>
            )}
        </span>
    );
}
