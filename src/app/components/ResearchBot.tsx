import clsx from "clsx";
import styles from "./styles/researchbot.module.scss";

export default function ResearchBot({
    className,
}: {
    className?: string;
}) {
    return (
        <svg
            className={clsx(styles.bot, className)}
            viewBox="0 0 96 112"
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <ellipse cx="48" cy="106" rx="18" ry="3" fill="#000" opacity="0.22" />

            <path
                d="M26 70c0-10 8-16 16-12l6 5 6-5c8-4 16 2 16 12l5 24c1 7-4 12-11 12H32c-7 0-12-5-11-12l5-24z"
                fill="#f7fbff"
            />
            <path d="M48 74v24" stroke="#e6eef7" strokeWidth="1.4" />
            <circle cx="48" cy="80" r="2" fill="#0ab1ff" />
            <circle cx="48" cy="88" r="2" fill="#ff0084" />
            <circle cx="48" cy="96" r="2" fill="#0ab1ff" />
            <rect x="58" y="82" width="11" height="9" rx="2" fill="#eaf2fb" />
            <rect x="60" y="78.5" width="2" height="7" rx="1" fill="#ff0084" />
            <rect x="63.4" y="79.6" width="1.7" height="5.8" rx="0.8" fill="#0ab1ff" />

            <path
                d="M30 76c-6 2-9 8-7 13"
                stroke="#f7fbff"
                strokeWidth="8"
                strokeLinecap="round"
            />
            <circle cx="21" cy="91" r="4.4" fill="#ff9ec6" />

            <g className={styles.wave}>
                <path
                    d="M66 72c7-2 12 0 13-8"
                    stroke="#f7fbff"
                    strokeWidth="8"
                    strokeLinecap="round"
                />
                <circle cx="81" cy="61" r="4.6" fill="#ff9ec6" />
            </g>

            <g className={styles.brain}>
                <path
                    d="M48 16c-6 0-12 4-14 10-8-2-16 4-14 14-4 8 0 18 10 22 4 6 10 8 18 8s14-2 18-8c10-4 14-14 10-22 2-10-6-16-14-14-2-6-8-10-14-10z"
                    fill="#ff8ebf"
                />
                <ellipse cx="33" cy="26" rx="11" ry="9" fill="#ffb0d4" />
                <ellipse cx="48" cy="19" rx="10" ry="8" fill="#ffc4e0" />
                <ellipse cx="63" cy="26" rx="11" ry="9" fill="#ffa3cc" />
                <ellipse cx="41" cy="22" rx="4" ry="2.2" fill="#fff" opacity="0.55" />
                <path
                    d="M48 18c-1 8-.4 18 0 30"
                    stroke="#ee5f98"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    opacity="0.55"
                />
                <path
                    d="M30 36c6 2 8 7 5 11M66 36c-6 2-8 7-5 11"
                    stroke="#ee5f98"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    opacity="0.4"
                />

                <ellipse cx="40" cy="42" rx="4.8" ry="5.4" fill="#3a2233" />
                <ellipse cx="56" cy="42" rx="4.8" ry="5.4" fill="#3a2233" />
                <circle cx="41.6" cy="40.1" r="1.8" fill="#fff" />
                <circle cx="57.6" cy="40.1" r="1.8" fill="#fff" />
                <circle cx="39" cy="43.6" r="0.7" fill="#ffd0e6" />
                <circle cx="55" cy="43.6" r="0.7" fill="#ffd0e6" />

                <g className={styles.blink}>
                    <ellipse cx="40" cy="42" rx="5.2" ry="5.8" fill="#ff8ebf" />
                    <ellipse cx="56" cy="42" rx="5.2" ry="5.8" fill="#ff8ebf" />
                </g>

                <ellipse cx="31" cy="50" rx="3.2" ry="1.8" fill="#ff4f93" opacity="0.28" />
                <ellipse cx="65" cy="50" rx="3.2" ry="1.8" fill="#ff4f93" opacity="0.28" />
                <path
                    d="M44 50.5c1.5 2.2 6.5 2.2 8 0"
                    stroke="#d44780"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                />
            </g>

            <path
                d="M36 60c3.5 8 7 11 12 11s8.5-3 12-11c-2.2 5-6 7.5-12 7.5S38.2 65 36 60z"
                fill="#fff"
            />
            <path
                d="M43 61.5c1.6 4.2 3.2 6 5 6s3.4-1.8 5-6"
                stroke="#ff0084"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}
