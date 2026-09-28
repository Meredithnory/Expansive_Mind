import { Suspense } from "react";
import RouteLoading from "../../../components/RouteLoading";
import PaperChatClient from "./PaperChatClient";
import { parseReportPaperNumber } from "../../../lib/paper-sources";

type PaperChatPageProps = {
    params: Promise<{ database: string; paperId: string[] }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | null {
    const item = Array.isArray(value) ? value[0] : value;
    return item ?? null;
}

export default async function PaperChatPage({ params, searchParams }: PaperChatPageProps) {
    const [{ database, paperId: paperIdParts }, query] = await Promise.all([
        params,
        searchParams,
    ]);
    const paperId = paperIdParts.map((segment) => decodeURIComponent(segment)).join("/");

    // Loading stays behind /api/paper: that handler composes optional auth,
    // content-access policy, messages, and the existing paper cache helpers.
    return (
        <Suspense fallback={<RouteLoading label="Preparing this paper…" />}>
            <PaperChatClient
                database={database}
                paperId={paperId}
                qParam={first(query.q)}
                focusExcerpt={first(query.focus)}
                locateMethod={first(query.intent) === "method"}
                requestedIdName={first(query.idName)}
                citeFocus={first(query.citeFocus) === "1"}
                focusLines={first(query.lines)}
                fromReport={first(query.from) === "report"}
                reportPaper={parseReportPaperNumber(first(query.paper))}
                reportGap={parseReportPaperNumber(first(query.gap))}
            />
        </Suspense>
    );
}
