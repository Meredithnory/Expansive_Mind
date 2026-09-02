import { useEffect, useRef, useState } from "react";
import {
    fetchInlineCompletion,
    searchQueriesMatch,
} from "./search-suggest";

interface UseInlineSearchSuggestionOptions {
    enabled?: boolean;
    delayMs?: number;
    slowHintMs?: number;
    showStatusHint?: boolean;
}

export function useInlineSearchSuggestion(
    searchValue: string,
    options: UseInlineSearchSuggestionOptions = {},
) {
    const {
        enabled = true,
        delayMs = 140,
        slowHintMs = 350,
        showStatusHint = true,
    } = options;
    const [inlineSuggestion, setInlineSuggestion] = useState<string | null>(
        null,
    );
    const [isFetching, setIsFetching] = useState(false);
    const [showSlowHint, setShowSlowHint] = useState(false);
    const requestIdRef = useRef(0);

    const clearInlineSuggestion = () => {
        setInlineSuggestion(null);
    };

    useEffect(() => {
        if (!enabled) {
            setInlineSuggestion(null);
            setIsFetching(false);
            setShowSlowHint(false);
            return;
        }

        const trimmed = searchValue.trim();
        if (!trimmed || trimmed.length < 2) {
            setInlineSuggestion(null);
            setIsFetching(false);
            setShowSlowHint(false);
            return;
        }

        const requestId = ++requestIdRef.current;
        let slowHintTimer: number | undefined;

        const timeout = window.setTimeout(async () => {
            setIsFetching(true);
            if (showStatusHint) {
                slowHintTimer = window.setTimeout(() => {
                    if (requestId === requestIdRef.current) {
                        setShowSlowHint(true);
                    }
                }, slowHintMs);
            }

            try {
                const completion = await fetchInlineCompletion(trimmed);

                if (requestId !== requestIdRef.current) {
                    return;
                }

                if (!completion || searchQueriesMatch(trimmed, completion)) {
                    setInlineSuggestion(null);
                    return;
                }

                setInlineSuggestion(completion);
            } finally {
                if (requestId === requestIdRef.current) {
                    setIsFetching(false);
                    setShowSlowHint(false);
                }
            }
        }, delayMs);

        return () => {
            window.clearTimeout(timeout);
            if (slowHintTimer) window.clearTimeout(slowHintTimer);
        };
    }, [searchValue, enabled, delayMs, slowHintMs, showStatusHint]);

    return {
        inlineSuggestion,
        isFetching,
        showSlowHint,
        clearInlineSuggestion,
    };
}
