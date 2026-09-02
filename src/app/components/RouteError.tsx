"use client";

import Link from "next/link";
import styles from "./styles/route-status.module.scss";

export default function RouteError({
    title,
    error,
    reset,
}: {
    title: string;
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className={styles.status} role="alert">
            <p className={styles.eyebrow}>Something went wrong</p>
            <h1>{title}</h1>
            <p>{error.message || "This page could not be loaded."}</p>
            <div className={styles.actions}>
                <button type="button" onClick={reset}>
                    Try again
                </button>
                <Link href="/">Return home</Link>
            </div>
        </div>
    );
}
