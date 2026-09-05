import "server-only";
import { normalizeLicense } from "../../../lib/content-access-policy";
import {
    normalizeCitation,
    normalizeDoi,
    normalizePmcid,
} from "../../../lib/research-citation";
import { providerFetchJson } from "../http";
import type { WorkIndex, WorkLead } from "../types";

const OPENALEX_WORKS = "https://api.openalex.org/works";

export function isOpenAlexConfigured(): boolean {
    return Boolean(
        process.env.OPENALEX_API_KEY || process.env.OPENALEX_MAILTO,
    );
}

function openAlexUrl(path: string, extra?: Record<string, string>): URL {
    const url = new URL(path);
    const key = process.env.OPENALEX_API_KEY;
    const mailto = process.env.OPENALEX_MAILTO;
    if (key) url.searchParams.set("api_key", key);
    else if (mailto) url.searchParams.set("mailto", mailto);
    if (extra) {
        for (const [name, value] of Object.entries(extra)) {
            url.searchParams.set(name, value);
        }
    }
    return url;
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function reconstructInvertedAbstract(index: unknown): string {
    if (!index || typeof index !== "object" || Array.isArray(index)) return "";
    const words: { word: string; pos: number }[] = [];
    for (const [word, positions] of Object.entries(
        index as Record<string, unknown>,
    )) {
        const list = Array.isArray(positions) ? positions : [];
        for (const pos of list) {
            if (typeof pos === "number") words.push({ word, pos });
        }
    }
    return words
        .sort((left, right) => left.pos - right.pos)
        .map((entry) => entry.word)
        .join(" ");
}

export function parseOpenAlexWork(raw: unknown): WorkLead | null {
    if (!raw || typeof raw !== "object") return null;
    const work = raw as Record<string, unknown>;
    const ids =
        work.ids && typeof work.ids === "object"
            ? (work.ids as Record<string, unknown>)
            : {};
    const doi = normalizeDoi(asString(ids.doi) || asString(work.doi));
    const pmcid = normalizePmcid(asString(ids.pmcid));
    const authorships = Array.isArray(work.authorships) ? work.authorships : [];
    const authors = authorships
        .map((item) => {
            if (!item || typeof item !== "object") return "";
            const author = (item as Record<string, unknown>).author;
            if (!author || typeof author !== "object") return "";
            return asString((author as Record<string, unknown>).display_name) || "";
        })
        .filter(Boolean);
    const primary =
        work.primary_location && typeof work.primary_location === "object"
            ? (work.primary_location as Record<string, unknown>)
            : {};
    const licenseHint = asString(primary.license);
    const licenseUrl = normalizeLicense(licenseHint, licenseHint).licenseUrl;
    const citation = normalizeCitation({
        title: asString(work.display_name) || asString(work.title),
        authors,
        doi,
        date: asString(work.publication_date) || asString(work.publication_year),
        url: doi ? `https://doi.org/${doi}` : undefined,
    });
    return {
        producer: "openalex",
        citation,
        abstract: reconstructInvertedAbstract(work.abstract_inverted_index),
        ...(pmcid ? { pmcid } : {}),
        licenseHint: licenseHint || null,
        licenseUrl,
    };
}

export const openAlexIndex: WorkIndex = {
    id: "openalex",
    isConfigured: isOpenAlexConfigured,
    async search({ query, page }) {
        if (!isOpenAlexConfigured()) return [];
        const url = openAlexUrl(OPENALEX_WORKS, {
            search: query,
            per_page: "10",
            page: String(page + 1),
        });
        const data = await providerFetchJson<{ results?: unknown[] }>(url);
        return (data?.results ?? [])
            .map(parseOpenAlexWork)
            .filter((lead): lead is WorkLead => Boolean(lead));
    },
    async resolveWork(doi) {
        if (!isOpenAlexConfigured()) return null;
        const normalized = normalizeDoi(doi);
        if (!normalized) return null;
        const url = openAlexUrl(
            `${OPENALEX_WORKS}/https://doi.org/${normalized}`,
        );
        const data = await providerFetchJson<unknown>(url);
        return parseOpenAlexWork(data);
    },
};
