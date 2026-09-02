"use client";
import React from "react";
import styles from "./styles/searchresults.module.scss";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import {
    buildPaperPath,
    resolveSourceFromSearch,
} from "../lib/paper-sources";
import { HighlightSearchTitle } from "../lib/highlight-search";
import type { ContentAccessPolicy } from "../lib/content-access-policy";

// CHANGED: This interface used to have a 'pmcid' field (which only worked for NIH papers).
// Now we have 'sourceId' which is the ID in whatever source system the paper came from,
// and an optional 'doi' field which is the universal DOI (Digital Object Identifier).
// This lets us handle papers from NIH, Springer, and future sources with the same component.
type MatchTier = "title" | "abstract" | "body";

interface SearchResult {
    sourceId: string; // CHANGED: was 'pmcid: string' — now works for any source (NIH pmcid, Springer DOI, etc.)
    doi?: string;     // ADDED: DOI is used for cross-source deduplication — same paper can appear on NIH and Springer
    title: string;
    authors: string[];
    date: string;
    abstract: string | string[] | null;
    matchTier?: MatchTier;
    source?: "nih" | "nature" | "scholar";
    sourceLabel?: string;
    sourceUrl?: string;
    contentLabel?: "Abstract" | "Search snippet";
    access?: ContentAccessPolicy;
}

// this function takes the abstract from the API and turns it into a plain string
// the abstract can come back in a bunch of different shapes depending on the source (NIH vs Springer)
// so we have to handle all of them here
const normalizeAbstract = (
    abstract: string | string[] | null | unknown,
): string => {
    // if there's no abstract at all just return empty string so nothing renders
    if (!abstract) return "";

    // NIH sometimes gives us an array of paragraphs so we join them with a space
    // also recursively call normalizeAbstract in case any item is itself an object
    if (Array.isArray(abstract)) {
        return abstract
            .map((item) =>
                typeof item === "string" ? item : normalizeAbstract(item),
            )
            .join(" ");
    }

    // simplest case — already a plain string, just return it
    if (typeof abstract === "string") return abstract;

    // this is the tricky one — the XML parser sometimes gives us a nested object
    // like { p: "some text" } or { "#text": "some text" } instead of a string
    // so we need to walk the whole object and pull out all the text values
    if (typeof abstract === "object") {
        // helper that recursively collects all string leaf values from any node
        const collect = (node: unknown): string[] => {
            if (!node) return [];
            if (typeof node === "string") return [node];
            // if it's an array just collect from each item
            if (Array.isArray(node)) return node.flatMap(collect);
            if (typeof node === "object") {
                return (
                    Object.entries(node)
                        // skip XML attribute keys (start with @) and internal keys (start with _)
                        // those are things like @pub-type or _text which aren't readable text
                        .filter(
                            ([k]) => !k.startsWith("@") && !k.startsWith("_"),
                        )
                        .flatMap(([, v]) => collect(v))
                );
            }
            return [];
        };
        // join all the text pieces we found into one string
        return collect(abstract).join(" ").trim();
    }

    // fallback just in case something weird comes through
    return "";
};

const formatPublicationDate = (date: string): string => {
    const trimmed = date?.trim();
    if (!trimmed) return "";

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

    return trimmed;
};

interface searchResultsProps {
    searchResults: SearchResult[];
    searchValue: string;
}

const SearchResults = ({ searchResults, searchValue }: searchResultsProps) => {
    const router = useRouter();
    const params = new URLSearchParams();
    params.append("q", searchValue);

    const handlePaperClick = (paper: SearchResult) => {
        const sourceConfig = resolveSourceFromSearch(paper.source);
        const idName = sourceConfig.defaultIdName;
        const paperId =
            paper.source === "nature"
                ? paper.doi || paper.sourceId
                : paper.sourceId;

        if (!paperId) return;

        const paperPath = buildPaperPath(
            sourceConfig.database,
            paperId,
            idName,
        );
        const separator = paperPath.includes("?") ? "&" : "?";
        router.push(`${paperPath}${separator}${params}`);
    };

    const renderTitle = (paper: SearchResult) => {
        const highlightClass =
            paper.source === "nature"
                ? styles.natureHighlight
                : paper.source === "scholar"
                  ? styles.scholarHighlight
                  : styles.nihHighlight;

        const titleNode = (
            <div className={clsx(styles.title, styles.text)}>
                <HighlightSearchTitle
                    title={paper.title}
                    searchValue={searchValue}
                    highlightClass={highlightClass}
                />
            </div>
        );

        return (
            <button
                onClick={() => handlePaperClick(paper)}
                style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                }}
            >
                {titleNode}
            </button>
        );
    };

    return (
        <div className={styles.paperwrap}>
            {searchResults.map((paper, index) => (
                <div
                    key={`${paper.sourceId}-${index}`}
                    className={clsx(
                        styles.paper,
                        paper.source === "nature" && styles.naturePaper,
                        paper.source === "scholar" && styles.scholarPaper,
                    )}
                >
                    <div className={styles.paperMeta}>
                        <div className={styles.metaTags}>
                        <div
                            className={clsx(
                                styles.sourceTag,
                                styles.text,
                                paper.source === "nature" && styles.natureTag,
                                paper.source === "scholar" && styles.scholarTag,
                            )}
                            aria-label={paper.sourceLabel || "NIH PubMed"}
                        >
                            <span
                                className={clsx(
                                    styles.sourceDot,
                                    paper.source === "nature" &&
                                        styles.natureDot,
                                    paper.source === "scholar" &&
                                        styles.scholarDot,
                                )}
                            />
                            <span className={styles.sourceText}>
                                {paper.sourceLabel || "NIH PubMed"}
                            </span>
                        </div>
                        <span className={styles.accessTag}>
                            {paper.source === "scholar"
                                ? "Resolve full text on open"
                                : paper.access?.canSendToAI
                                ? "Full text + AI"
                                : paper.source === "nih"
                                  ? "License checked on open"
                                  : "Metadata only"}
                        </span>
                        </div>
                        {paper.date && (
                            <time
                                className={clsx(
                                    styles.publicationdate,
                                    paper.source === "nature"
                                        ? styles.natureDate
                                        : paper.source === "scholar"
                                          ? styles.scholarDate
                                          : styles.nihDate,
                                )}
                                dateTime={paper.date}
                            >
                                <span className={styles.dateLabel}>
                                    Published
                                </span>
                                <span className={styles.dateValue}>
                                    {formatPublicationDate(paper.date)}
                                </span>
                            </time>
                        )}
                    </div>
                    {renderTitle(paper)}
                    <div className={clsx(styles.author, styles.text)}>
                        {Array.isArray(paper.authors)
                            ? paper.authors.join(", ")
                            : "No authors listed."}
                    </div>
                    {normalizeAbstract(paper.abstract) && (
                        <div className={clsx(styles.abstract, styles.text)}>
                            <strong>
                                {paper.contentLabel || "Abstract"}:
                            </strong>{" "}
                            {normalizeAbstract(paper.abstract)}
                        </div>
                    )}
                    {paper.sourceUrl &&
                        !paper.access?.canDisplayFullText && (
                            <a
                                className={styles.sourceLink}
                                href={paper.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                            >
                                Open canonical source
                            </a>
                        )}
                </div>
            ))}
        </div>
    );
};

export default SearchResults;
