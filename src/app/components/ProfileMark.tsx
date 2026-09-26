import type { CSSProperties } from "react";
import { profileColorHex } from "../lib/profile-colors";
import styles from "./styles/profile-mark.module.scss";

/** The reader's profile mark: the brain logo tinted in their chosen color. */
export default function ProfileMark({
    color,
    size = 40,
    label,
}: {
    color?: string | null;
    size?: number;
    label?: string;
}) {
    const style = {
        "--mark-color": profileColorHex(color),
        "--mark-size": `${size}px`,
    } as CSSProperties;
    return (
        <span
            className={styles.mark}
            style={style}
            role={label ? "img" : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
        >
            <span className={styles.brain} />
        </span>
    );
}
