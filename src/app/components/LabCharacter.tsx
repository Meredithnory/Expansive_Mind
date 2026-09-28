import { useId } from "react";
import { coatColor } from "../lib/profile-colors";
import { EMPTY_BADGE, describeOutfit, type Badge } from "../lib/lab-badge";
import styles from "./styles/lab-character.module.scss";

// Mirror an accessory onto the character's left side, away from the name tag.
const MIRROR = "translate(240 0) scale(-1 1)";

// "full" is the whole character (240×300). "portrait" crops to head and
// shoulders for round avatars.
const VIEW_BOX = { full: "0 0 240 300", portrait: "36 22 168 168" } as const;

/** The reader's lab badge character: a colorful brain-head in their coat and extras. */
export default function LabCharacter({
    color,
    badge,
    width,
    crop = "full",
    animated = true,
    label,
}: {
    color?: string | null;
    badge?: Badge | null;
    width: number;
    crop?: keyof typeof VIEW_BOX;
    animated?: boolean;
    /** Accessible name; omit when a visible name sits next to it. */
    label?: string;
}) {
    const clipId = useId();
    const coat = coatColor(color);
    const b = badge ?? EMPTY_BADGE;
    const height = crop === "full" ? (width * 300) / 240 : width;
    const glove = b.hand !== "none";

    return (
        <svg
            width={width}
            height={height}
            viewBox={VIEW_BOX[crop]}
            className={animated ? styles.animated : undefined}
            role={label ? "img" : undefined}
            aria-label={label ? `${label}: ${describeOutfit(coat.label, b)}` : undefined}
            aria-hidden={label ? undefined : true}
            focusable="false"
        >
            <defs>
                <clipPath id={clipId}>
                    <circle cx="120" cy="98" r="62" />
                </clipPath>
            </defs>

            {crop === "full" && <ellipse cx="120" cy="296" rx="90" ry="7" fill="rgba(255,255,255,0.06)" />}

            {b.head === "headlamp" && (
                <g transform={MIRROR}>
                    <path d="M128 70 L250 26 L250 124 Z" fill="rgba(255,243,176,0.16)" />
                </g>
            )}

            <rect x="108" y="146" width="24" height="22" rx="6" fill="#2a2a33" />
            <path d="M44 300 C44 230 56 192 92 176 L148 176 C184 192 196 230 196 300 Z" fill={coat.hex} />
            <path d="M100 176 L120 212 L140 176 Z" fill="#15151c" />
            <path d="M100 176 L120 212 L112 250 L82 188 Z" fill={coat.shade} />
            <path d="M140 176 L120 212 L128 250 L158 188 Z" fill={coat.shade} />
            <circle cx="120" cy="262" r="3.5" fill={coat.shade} />
            <circle cx="120" cy="284" r="3.5" fill={coat.shade} />
            <path d="M60 254 L96 254 L96 278 Q78 284 60 278 Z" fill={coat.shade} opacity="0.7" />
            <rect x="136" y="226" width="46" height="26" rx="4" fill="#f7f4ee" />
            <rect x="136" y="226" width="46" height="7" rx="2" fill={coat.shade} />
            <rect x="141" y="238" width="30" height="3.5" rx="1.5" fill="#1a1a22" />
            <rect x="141" y="245" width="20" height="2.5" rx="1.2" fill="#8a8a96" />

            {b.neck === "stethoscope" && (
                <g>
                    <path d="M94 180 C84 216 102 236 120 236 C138 236 156 216 146 180" stroke="#c9ced8" strokeWidth="4" fill="none" strokeLinecap="round" />
                    <circle cx="120" cy="242" r="7" fill="#c9ced8" />
                    <circle cx="120" cy="242" r="3" fill="#8a93a3" />
                </g>
            )}

            {b.hand === "flask" && (
                <g transform={MIRROR}>
                    <path d="M190 186 L204 186 L204 206 L220 240 Q224 252 212 252 L182 252 Q170 252 174 240 L190 206 Z" fill="rgba(210,236,255,0.22)" stroke="#e8ecf2" strokeWidth="3" strokeLinejoin="round" />
                    <path d="M181 230 L213 230 L218 242 Q220 249 212 249 L182 249 Q174 249 176 242 Z" fill="#7cf29a" />
                    <circle className={styles.fizz} cx="192" cy="236" r="3" fill="#d8ffe3" />
                    <circle className={`${styles.fizz} ${styles.delay1}`} cx="202" cy="240" r="2.2" fill="#d8ffe3" />
                    <circle className={`${styles.fizz} ${styles.delay2}`} cx="197" cy="244" r="2.6" fill="#d8ffe3" />
                    <rect x="187" y="181" width="20" height="7" rx="3" fill="#e8ecf2" />
                </g>
            )}
            {b.hand === "pipette" && (
                <g transform={MIRROR}>
                    <path d="M188 252 L208 176" stroke="#e8ecf2" strokeWidth="6" strokeLinecap="round" />
                    <path d="M188 252 L185 264" stroke="#e8ecf2" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="210" cy="170" r="9" fill="#ff4fa3" />
                    <circle className={styles.drip} cx="184" cy="272" r="3.2" fill="#7cd3ff" />
                </g>
            )}
            {b.hand === "clipboard" && (
                <g>
                    <rect x="28" y="204" width="44" height="54" rx="5" fill="#c8a26b" />
                    <rect x="33" y="213" width="34" height="40" rx="2" fill="#f7f4ee" />
                    <rect x="42" y="199" width="16" height="9" rx="3" fill="#8a93a3" />
                    <rect x="38" y="221" width="22" height="3" rx="1.5" fill="#1a1a22" />
                    <rect x="38" y="229" width="16" height="3" rx="1.5" fill="#8a8a96" />
                    <path d="M38 241 L42 245 L50 236" stroke="#22a06b" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
            )}
            {glove && (
                <g transform={MIRROR}>
                    <circle cx="192" cy="256" r="11" fill="#8ccbff" />
                    <path d="M183 252 Q192 246 201 252" stroke="#6bb4f2" strokeWidth="2" fill="none" strokeLinecap="round" />
                </g>
            )}

            <g clipPath={`url(#${clipId})`}>
                <rect x="58" y="36" width="124" height="124" fill="#2b2340" />
                <circle cx="94" cy="78" r="36" fill="#ff4fa3" />
                <circle cx="142" cy="68" r="34" fill="#f5a524" />
                <circle cx="152" cy="114" r="32" fill="#3b82f6" />
                <circle cx="102" cy="124" r="34" fill="#22a06b" />
                <circle cx="124" cy="96" r="22" fill="#8b5cf6" opacity="0.92" />
            </g>
            <circle cx="120" cy="98" r="62" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
            <ellipse cx="96" cy="64" rx="18" ry="10" fill="#ffffff" opacity="0.22" transform="rotate(-28 96 64)" />

            {b.head === "goggles" && (
                <g>
                    <path d="M60 76 L84 72 M156 72 L180 76" stroke="#e8ecf2" strokeWidth="4" strokeLinecap="round" />
                    <rect x="84" y="60" width="34" height="22" rx="10" fill="rgba(190,232,255,0.35)" stroke="#e8ecf2" strokeWidth="3" />
                    <rect x="122" y="60" width="34" height="22" rx="10" fill="rgba(190,232,255,0.35)" stroke="#e8ecf2" strokeWidth="3" />
                    <path d="M118 71 L122 71" stroke="#e8ecf2" strokeWidth="3" />
                </g>
            )}
            {b.head === "gradcap" && (
                <g transform={MIRROR}>
                    <path d="M90 44 L90 58 Q120 72 150 58 L150 44 Z" fill="#1b1b24" />
                    <path d="M66 40 L120 18 L174 40 L120 62 Z" fill="#23232e" stroke="#3a3a48" strokeWidth="2" strokeLinejoin="round" />
                    <circle cx="120" cy="40" r="3.5" fill="#f5a524" />
                    <path d="M120 40 L164 46 L166 70" stroke="#f5a524" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <rect x="161" y="68" width="10" height="14" rx="3" fill="#f5a524" />
                </g>
            )}
            {b.head === "headlamp" && (
                <g transform={MIRROR}>
                    <path d="M60 86 Q120 66 180 86" stroke="#2a2a33" strokeWidth="8" fill="none" strokeLinecap="round" />
                    <circle cx="126" cy="72" r="12" fill="#e8ecf2" />
                    <circle className={styles.glow} cx="126" cy="72" r="7" fill="#fff3b0" />
                </g>
            )}

            {b.sidekick === "mouse" && crop === "full" && (
                <g transform={MIRROR}>
                    <g className={styles.peek}>
                        <path d="M22 286 Q4 282 8 266" stroke="#ffb3d1" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                        <ellipse cx="44" cy="282" rx="22" ry="15" fill="#d9dde6" />
                        <path d="M30 280 Q44 268 58 280 L58 294 Q44 298 30 294 Z" fill={coat.hex} />
                        <circle cx="66" cy="270" r="12" fill="#d9dde6" />
                        <circle cx="61" cy="258" r="7" fill="#d9dde6" />
                        <circle cx="61" cy="258" r="4" fill="#ffb3d1" />
                        <circle cx="73" cy="260" r="5.5" fill="#d9dde6" />
                        <circle cx="73" cy="260" r="3" fill="#ffb3d1" />
                        <circle cx="70" cy="269" r="2" fill="#15151c" />
                        <circle cx="78" cy="273" r="2.4" fill="#ff6fb5" />
                    </g>
                </g>
            )}
            {b.sidekick === "dna" && (
                <g transform={MIRROR}>
                    <g className={styles.dna}>
                        <path d="M202 108 C226 120 202 136 226 148 C202 160 226 172 202 184" stroke="#22a06b" strokeWidth="4" fill="none" strokeLinecap="round" />
                        <path d="M226 108 C202 120 226 136 202 148 C226 160 202 172 226 184" stroke="#8b5cf6" strokeWidth="4" fill="none" strokeLinecap="round" />
                        <path d="M208 116 L220 116 M206 130 L222 130 M208 142 L220 142 M208 154 L220 154 M206 166 L222 166 M208 178 L220 178" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" />
                    </g>
                </g>
            )}

            {b.effect === "sparkles" && (
                <g>
                    <path className={styles.twinkle} d="M40 40 L43 50 L53 53 L43 56 L40 66 L37 56 L27 53 L37 50 Z" fill="#fff3b0" />
                    <path className={`${styles.twinkle} ${styles.delay1}`} d="M206 26 L208 33 L215 35 L208 37 L206 44 L204 37 L197 35 L204 33 Z" fill="#ffffff" />
                    <path className={`${styles.twinkle} ${styles.delay2}`} d="M30 150 L32 157 L39 159 L32 161 L30 168 L28 161 L21 159 L28 157 Z" fill="#ff8ec4" />
                    <path className={`${styles.twinkle} ${styles.delay1}`} d="M222 212 L224 219 L231 221 L224 223 L222 230 L220 223 L213 221 L220 219 Z" fill="#7cd3ff" />
                </g>
            )}

            <circle cx="186" cy="50" r="5" fill="#22a06b" />
            <circle cx="198" cy="68" r="4" fill="#f5a524" />
            <circle cx="180" cy="34" r="3.5" fill="#3b82f6" />
            <circle cx="202" cy="42" r="3" fill="#ff4fa3" />
        </svg>
    );
}
