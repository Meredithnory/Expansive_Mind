import LabCharacter from "../components/LabCharacter";
import { coatColor } from "../lib/profile-colors";
import type { Badge } from "../lib/lab-badge";
import styles from "./profile.module.scss";

/** First name + last initial, the way the forum shows people. */
export function tagName(firstName?: string, lastName?: string): string {
    const first = (firstName || "").trim();
    const initial = (lastName || "").trim().charAt(0);
    return [first, initial && `${initial}.`].filter(Boolean).join(" ") || "Researcher";
}

export function NameTag({
    color,
    name,
    role,
    field,
}: {
    color?: string | null;
    name: string;
    role?: string | null;
    field?: string;
}) {
    const coat = coatColor(color);
    return (
        <div className={styles.nameTag}>
            <span className={styles.nameTagClip} aria-hidden="true" />
            <div className={styles.nameTagCard}>
                <div className={styles.nameTagHeader} style={{ background: coat.hex, color: coat.ink }}>
                    <span>Expansive Mind</span>
                    <span>Hello</span>
                </div>
                <div className={styles.nameTagBody}>
                    <strong>{name}</strong>
                    <span className={styles.nameTagRole}>{role || "Add your role"}</span>
                    <span className={styles.nameTagField}>{field || "Add your field"}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * The character on its stage: dot grid, a soft glow in the coat color and
 * bubbles drifting up like the logo's dots. `hop` restarts a small jump each
 * time it changes (wardrobe changes in the editor).
 */
export default function BadgeStage({
    color,
    badge,
    label,
    greeting,
    hop = 0,
    children,
}: {
    color?: string | null;
    badge: Badge;
    label: string;
    greeting?: string;
    hop?: number;
    children?: React.ReactNode;
}) {
    const coat = coatColor(color);
    const hopClass = hop === 0 ? "" : hop % 2 ? styles.hopA : styles.hopB;
    return (
        <div className={styles.stage}>
            <div className={styles.stageGlow} style={{ background: coat.hex }} aria-hidden="true" />
            <div className={`${styles.character} ${hopClass}`}>
                <div className={styles.bubbles} aria-hidden="true">
                    <span style={{ background: "#22a06b" }} />
                    <span style={{ background: "#f5a524" }} />
                    <span style={{ background: "#3b82f6" }} />
                    <span style={{ background: "#ff4fa3" }} />
                </div>
                {greeting && <p className={styles.greeting}>{greeting}</p>}
                <div className={styles.bob}>
                    <LabCharacter color={color} badge={badge} width={240} label={label} />
                </div>
            </div>
            {children}
        </div>
    );
}
