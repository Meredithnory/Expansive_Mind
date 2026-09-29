// Tile icons for the badge editor's Extras tab, one per accessory id.
export default function ExtraIcon({ id }: { id: string }) {
    return (
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            {id === "none" && (
                <>
                    <circle cx="16" cy="16" r="9" stroke="#6b7280" strokeWidth="2" fill="none" />
                    <path d="M10 22 L22 10" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
                </>
            )}
            {id === "goggles" && (
                <>
                    <rect x="4" y="11" width="11" height="10" rx="4.5" stroke="#e8ecf2" strokeWidth="2" fill="rgba(190,232,255,0.3)" />
                    <rect x="17" y="11" width="11" height="10" rx="4.5" stroke="#e8ecf2" strokeWidth="2" fill="rgba(190,232,255,0.3)" />
                    <path d="M15 16 L17 16" stroke="#e8ecf2" strokeWidth="2" />
                </>
            )}
            {id === "gradcap" && (
                <>
                    <path d="M3 13 L16 7 L29 13 L16 19 Z" fill="#3a3a48" stroke="#c9ced8" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M9 16 L9 21 Q16 25 23 21 L23 16" fill="#3a3a48" stroke="#c9ced8" strokeWidth="1.5" />
                    <path d="M16 13 L6 15 L6 22" stroke="#f5a524" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                </>
            )}
            {id === "headlamp" && (
                <>
                    <path d="M14 16 L2 10 L2 22 Z" fill="rgba(255,243,176,0.35)" />
                    <circle cx="18" cy="16" r="7" fill="#e8ecf2" />
                    <circle cx="18" cy="16" r="4" fill="#fff3b0" />
                </>
            )}
            {id === "flask" && (
                <>
                    <path d="M12 5 L20 5 M13 5 L13 13 L6 25 Q5 28 8 28 L24 28 Q27 28 26 25 L19 13 L19 5" stroke="#e8ecf2" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
                    <path d="M8.5 21 L23.5 21 L25 25 Q25.5 27 23.5 27 L8.5 27 Q6.5 27 7 25 Z" fill="#7cf29a" />
                </>
            )}
            {id === "pipette" && (
                <>
                    <path d="M8 26 L20 10" stroke="#e8ecf2" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="22" cy="8" r="4.5" fill="#ff4fa3" />
                    <circle cx="6.5" cy="29" r="1.8" fill="#7cd3ff" />
                </>
            )}
            {id === "clipboard" && (
                <>
                    <rect x="7" y="6" width="18" height="23" rx="3" fill="#c8a26b" />
                    <rect x="10" y="10" width="12" height="16" rx="1" fill="#f7f4ee" />
                    <rect x="12" y="4" width="8" height="5" rx="2" fill="#8a93a3" />
                    <path d="M12 19 L14 21 L19 16" stroke="#22a06b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                </>
            )}
            {id === "stethoscope" && (
                <>
                    <path d="M8 5 C5 15 9 21 16 21 C23 21 27 15 24 5" stroke="#c9ced8" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                    <path d="M16 21 L16 24" stroke="#c9ced8" strokeWidth="2.2" />
                    <circle cx="16" cy="26.5" r="3.5" fill="#c9ced8" />
                </>
            )}
            {id === "mouse" && (
                <>
                    <ellipse cx="14" cy="21" rx="9" ry="6.5" fill="#d9dde6" />
                    <circle cx="22" cy="16" r="5.5" fill="#d9dde6" />
                    <circle cx="20" cy="10.5" r="3.2" fill="#ffb3d1" />
                    <circle cx="26" cy="12" r="2.4" fill="#ffb3d1" />
                    <circle cx="24" cy="16" r="1.1" fill="#15151c" />
                    <path d="M5 21 Q1 19 3 14" stroke="#ffb3d1" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </>
            )}
            {id === "dna" && (
                <>
                    <path d="M10 3 C22 9 10 15 22 21 C10 27 16 29 16 29" stroke="#22a06b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                    <path d="M22 3 C10 9 22 15 10 21 C22 27 16 29 16 29" stroke="#8b5cf6" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                </>
            )}
            {id === "sparkles" && (
                <>
                    <path d="M13 4 L15 11 L22 13 L15 15 L13 22 L11 15 L4 13 L11 11 Z" fill="#fff3b0" />
                    <path d="M24 18 L25 22 L29 23 L25 24 L24 28 L23 24 L19 23 L23 22 Z" fill="#ff8ec4" />
                </>
            )}
        </svg>
    );
}
