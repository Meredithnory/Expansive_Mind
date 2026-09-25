import clsx from "clsx";
import styles from "./styles/paperstack.module.scss";

export default function PaperStack({
    size = "small",
}: {
    size?: "small" | "large";
}) {
    return (
        <span
            className={clsx(styles.stack, size === "large" && styles.large)}
            aria-hidden="true"
        >
            <span className={styles.sheetBack} />
            <span className={styles.sheetMid} />
            <span className={styles.page}>
                <span />
                <span />
                <span />
                <i />
            </span>
            <span className={styles.page}>
                <span />
                <span />
                <span />
                <i />
            </span>
        </span>
    );
}
