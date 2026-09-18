import type { ReactElement } from "react";
import { SITE_STATUS } from "./site-status";
import styles from "./styles/site-status.module.scss";

export default function SiteStatus(): ReactElement {
    return (
        <aside className={styles.strip} aria-label={SITE_STATUS.srLabel}>
            <p className={styles.label} aria-hidden="true">
                {SITE_STATUS.label}
            </p>
        </aside>
    );
}
