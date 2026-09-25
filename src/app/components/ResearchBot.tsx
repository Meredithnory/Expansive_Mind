import clsx from "clsx";
import styles from "./styles/researchbot.module.scss";

const SPARKS = ["yellow", "pink", "blue", "green"] as const;

export default function ResearchBot({ className }: { className?: string }) {
    return (
        <span className={clsx(styles.bot, className)} aria-hidden="true">
            <span className={styles.aura} />
            <span className={styles.figure}>
                <img
                    className={styles.head}
                    src="/brainlogo.svg"
                    alt=""
                    width={80}
                    height={80}
                />
                <span className={styles.coat}>
                    <span className={styles.notch} />
                    <span className={styles.pocket} />
                    <span className={styles.button} />
                    <span className={clsx(styles.button, styles.buttonLower)} />
                </span>
            </span>
            {SPARKS.map((color) => (
                <i key={color} className={styles[color]} />
            ))}
        </span>
    );
}
