"use client";
import React, { Fragment, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import styles from "./styles/searchresults.module.scss";
import { buildPaperPath, resolveSourceFromSearch } from "../lib/paper-sources";
import { HighlightSearchAbstract } from "../lib/highlight-search";
import type { ContentAccessPolicy } from "../lib/content-access-policy";
import type { CitationSource } from "../lib/paper-impact";
import { resolveScholarCitesId } from "../lib/citing-works";
import {
    RESULT_SOURCE_COLOR,
    normalizeAbstract,
    resultAccess,
    resultOpenLabel,
    resultSourceKey,
    resultSourceLink,
    resultSourceName,
    resultYear,
    shortAuthors,
} from "../lib/search-result-view";
import PaperImpactBadge from "./PaperImpactBadge";

export interface SearchResult {
    /** The paper's ID in its own source (NIH PMCID, Springer DOI, Scholar cluster). */
    sourceId: string;
    /** Used to open Europe PMC and Crossref rows in the reader. */
    doi?: string;
    title: string;
    authors: string[];
    date: string;
    abstract: string | string[] | null;
    matchTier?: "title" | "abstract" | "body";
    source?: "nih" | "nature" | "scholar" | "europepmc" | "crossref";
    pmcid?: string;
    sourceLabel?: string;
    sourceUrl?: string;
    contentLabel?: "Abstract" | "Search snippet";
    access?: ContentAccessPolicy;
    citationCount?: number;
    citationSource?: CitationSource;
    scholarCitesId?: string;
    clusterId?: string;
}

/** The reader route for a row, carrying the query so the paper opens highlighted. */
export function searchResultHref(paper: SearchResult, query: string): string | null {
    let path: string | null = null;
    if (paper.source === "europepmc" && paper.pmcid) {
        path = buildPaperPath("nih", paper.pmcid, "pmcid");
    } else if (
        (paper.source === "europepmc" || paper.source === "crossref") &&
        paper.doi
    ) {
        path = buildPaperPath("springer", paper.doi, "doi");
    } else if (paper.source !== "europepmc" && paper.source !== "crossref") {
        const sourceConfig = resolveSourceFromSearch(paper.source);
        const paperId =
            paper.source === "nature" ? paper.doi || paper.sourceId : paper.sourceId;
        if (paperId) {
            path = buildPaperPath(
                sourceConfig.database,
                paperId,
                sourceConfig.defaultIdName,
            );
        }
    }
    if (!path) return null;
    const params = new URLSearchParams({ q: query });
    return `${path}${path.includes("?") ? "&" : "?"}${params}`;
}

interface SearchResultsProps {
    searchResults: SearchResult[];
    searchValue: string;
    /** Shown in the list after the second row (the phone's "Go deeper" card). */
    inlineAside?: ReactNode;
}

const SearchResults = ({ searchResults, searchValue, inlineAside }: SearchResultsProps) => {
    const asideRow = inlineAside ? (
        <li className={styles.asideRow}>{inlineAside}</li>
    ) : null;

    return (
        <ul className={styles.list} aria-label="Results">
            {searchResults.map((paper, index) => {
                const href = searchResultHref(paper, searchValue);
                const access = resultAccess(paper);
                const year = resultYear(paper.date);
                const authors = shortAuthors(paper.authors);
                const snippet = normalizeAbstract(paper.abstract);
                const sourceLink = resultSourceLink(paper);
                return (
                    <Fragment key={`${paper.source}-${paper.sourceId}-${index}`}>
                        <li className={styles.row}>
                            <div className={styles.meta}>
                                <span className={styles.source}>
                                    <span
                                        className={styles.dot}
                                        style={{ background: RESULT_SOURCE_COLOR[resultSourceKey(paper)] }}
                                        aria-hidden="true"
                                    />
                                    {resultSourceName(paper)}
                                    {year ? ` · ${year}` : ""}
                                </span>
                                <span className={clsx(styles.access, access.full && styles.accessFull)}>
                                    {access.label}
                                </span>
                            </div>
                            {href ? (
                                <Link href={href} className={styles.title}>
                                    {paper.title}
                                </Link>
                            ) : (
                                <span className={styles.title}>{paper.title}</span>
                            )}
                            {authors ? <span className={styles.authors}>{authors}</span> : null}
                            {snippet ? (
                                <p className={styles.snippet}>
                                    <HighlightSearchAbstract
                                        abstract={snippet}
                                        searchValue={searchValue}
                                        title={null}
                                        highlightClass={styles.hit}
                                    />
                                </p>
                            ) : null}
                            <div className={styles.actions}>
                                {href ? (
                                    <Link href={href} className={styles.open}>
                                        {resultOpenLabel(paper)}
                                        <span aria-hidden="true">→</span>
                                    </Link>
                                ) : null}
                                {sourceLink ? (
                                    <a
                                        className={styles.sourceLink}
                                        href={sourceLink}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        View source
                                        <span aria-hidden="true">↗</span>
                                    </a>
                                ) : null}
                                <span className={styles.impact}>
                                    <PaperImpactBadge
                                        citationCount={paper.citationCount}
                                        citationSource={paper.citationSource}
                                        doi={paper.doi}
                                        scholarCitesId={resolveScholarCitesId({
                                            scholarCitesId: paper.scholarCitesId,
                                            database:
                                                paper.source === "scholar" ? "scholar" : undefined,
                                            idName:
                                                paper.source === "scholar" ? "cluster_id" : undefined,
                                            paperId: paper.sourceId,
                                            clusterId: paper.clusterId,
                                        })}
                                        sourcePaper={{
                                            title: paper.title,
                                            doi: paper.doi,
                                            authors: Array.isArray(paper.authors) ? paper.authors : [],
                                            year: paper.date,
                                        }}
                                    />
                                </span>
                            </div>
                        </li>
                        {index === 1 ? asideRow : null}
                    </Fragment>
                );
            })}
            {searchResults.length < 2 ? asideRow : null}
        </ul>
    );
};

export default SearchResults;
