"use client";

import Loading from "./Loading";
import styles from "./styles/route-status.module.scss";

export default function RouteLoading({ label }: { label: string }) {
    return (
        <div className={styles.status} role="status" aria-live="polite">
            <Loading />
            <p>{label}</p>
        </div>
    );
}
