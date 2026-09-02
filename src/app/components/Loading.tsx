import { useEffect, useState } from "react";

const Loading = () => {
    return (
        <span className="loader" role="status" aria-label="Loading">
            <svg viewBox="0 0 64 32" aria-hidden="true" focusable="false">
                <path d="M5 6c13 0 13 20 27 20S46 6 59 6" />
                <path d="M5 26C18 26 18 6 32 6s14 20 27 20" />
                <path d="M14 10h36M14 22h36" />
            </svg>
        </span>
    );
};

export const LoadingOverlay = ({
    visible,
    label = "Loading…",
}: {
    visible: boolean;
    label?: string;
}) => {
    const [mounted, setMounted] = useState(false);
    const [active, setActive] = useState(false);

    useEffect(() => {
        let showTimer: ReturnType<typeof setTimeout> | undefined;
        let hideTimer: ReturnType<typeof setTimeout> | undefined;
        let frame: number | undefined;

        if (visible) {
            showTimer = setTimeout(() => {
                setMounted(true);
                frame = requestAnimationFrame(() => setActive(true));
            }, 150);
        } else {
            setActive(false);
            hideTimer = setTimeout(() => setMounted(false), 220);
        }

        return () => {
            if (showTimer) clearTimeout(showTimer);
            if (hideTimer) clearTimeout(hideTimer);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [visible]);

    if (!mounted) return null;

    return (
        <div
            className={`loading-overlay${active ? " loading-overlay--active" : ""}`}
            role="status"
            aria-live="polite"
            aria-label={label}
        >
            <div className="loading-overlay__content">
                <Loading />
                <span>{label}</span>
            </div>
        </div>
    );
};

export default Loading;
