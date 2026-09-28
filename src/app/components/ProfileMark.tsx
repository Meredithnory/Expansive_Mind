import type { CSSProperties } from "react";
import type { Badge } from "../lib/lab-badge";
import { profileColorHex } from "../lib/profile-colors";
import LabCharacter from "./LabCharacter";
import styles from "./styles/profile-mark.module.scss";

/** A reader's avatar: their lab badge character, head and shoulders, ringed in their coat color. */
export default function ProfileMark({
    color,
    badge,
    size = 40,
    label,
}: {
    color?: string | null;
    badge?: Badge | null;
    size?: number;
    label?: string;
}) {
    const style = {
        "--mark-color": profileColorHex(color),
        "--mark-size": `${size}px`,
    } as CSSProperties;
    return (
        <span className={styles.mark} style={style}>
            <LabCharacter
                color={color}
                badge={badge}
                width={size}
                crop="portrait"
                animated={false}
                label={label}
            />
        </span>
    );
}
