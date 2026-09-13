import { useCallback, useEffect, useRef, useState } from "react";
import { looksLikeUnclearResearchQuestion } from "./query-quality";
import { fetchDiscoveryQueryAssessment } from "./discover-suggest";
import type { DiscoveryQueryAssessment } from "./query-quality";

const emptyAssessment = (): DiscoveryQueryAssessment => ({
    status: "ok",
    suggestion: null,
});

export function useDiscoveryQuerySuggestion(
    question: string,
    options: { enabled?: boolean; delayMs?: number } = {},
) {
    const { enabled = true, delayMs = 400 } = options;
    const [assessment, setAssessment] =
        useState<DiscoveryQueryAssessment>(emptyAssessment);
    const [assessedQuery, setAssessedQuery] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const requestIdRef = useRef(0);

    const clearAssessment = useCallback(() => {
        requestIdRef.current += 1;
        setAssessment(emptyAssessment());
        setAssessedQuery(null);
        setIsChecking(false);
    }, []);

    useEffect(() => {
        if (!enabled) {
            clearAssessment();
            return;
        }

        const trimmed = question.trim();
        if (trimmed.length < 3) {
            clearAssessment();
            return;
        }

        if (looksLikeUnclearResearchQuestion(trimmed)) {
            requestIdRef.current += 1;
            setAssessment({ status: "unclear", suggestion: null });
            setAssessedQuery(trimmed);
            setIsChecking(false);
            return;
        }

        setAssessedQuery(null);
        const requestId = ++requestIdRef.current;
        const timeout = window.setTimeout(async () => {
            setIsChecking(true);
            try {
                const next = await fetchDiscoveryQueryAssessment(trimmed);
                if (requestId !== requestIdRef.current) return;
                setAssessment(next ?? emptyAssessment());
                setAssessedQuery(trimmed);
            } finally {
                if (requestId === requestIdRef.current) {
                    setIsChecking(false);
                }
            }
        }, delayMs);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [delayMs, enabled, question]);

    return {
        assessment,
        assessedQuery,
        isChecking,
        clearAssessment,
    };
}
