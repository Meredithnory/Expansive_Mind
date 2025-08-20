// parseArticles.ts
// npm i fast-xml-parser
import { XMLParser } from "fast-xml-parser";

export interface ArticleSummary {
    pmcid: string | null; // digits only, e.g. "12333199"
    title: string | null;
    authors: string[];
    abstract: string | string[] | null; // single string if one paragraph, else array
    date: string | null; // e.g., "2025 Aug 8"
}

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
    preserveOrder: false,
    removeNSPrefix: true,
    parseTagValue: false,
});

/**
 * Entry point: pass the XML string from res.text()
 */
export function parseArticlesFromXml(xml: string): ArticleSummary[] {
    const root = safeParse(xml);
    if (!root) return [];

    // Collect JATS <article> nodes anywhere
    const jatsArticles = findNodesByTag(root, "article");

    // Collect PubMed <PubmedArticle> nodes anywhere
    const pubmedArticles = findNodesByTag(root, "PubmedArticle");

    const results: ArticleSummary[] = [];

    for (const node of jatsArticles) {
        results.push(mapJatsArticle(node));
    }

    for (const node of pubmedArticles) {
        results.push(mapPubMedArticle(node));
    }

    // If nothing found, attempt generic best-effort by looking for
    // common subtrees that resemble JATS article-meta
    if (results.length === 0) {
        const genericArticles = findLikelyArticleNodes(root);
        for (const node of genericArticles) {
            results.push(mapJatsArticle(node));
        }
    }

    // De-dup if both JATS and PubMed forms point to same PMCID
    return dedupeBy(results, (a) => a.pmcid ?? `${a.title}|${a.date}`);
}

/* --------------------------- Mappers (JATS) --------------------------- */

function mapJatsArticle(article: any): ArticleSummary {
    const front = article?.front ?? get(article, ["front"]) ?? article;
    const meta =
        front?.["article-meta"] ??
        get(front, ["article-meta"]) ??
        get(article, ["article-meta"]) ??
        article;

    const pmcid = normalizePmcId(
        findArticleId(meta, "pmcid") ??
            findArticleId(meta, "pmc") ??
            extractText(get(meta, ["article-id"])) ??
            null
    );

    const title = textify(
        get(meta, ["title-group", "article-title"]) ??
            get(meta, ["article-title"]) ??
            get(article, ["article-title"])
    );

    const authors = extractJatsAuthors(meta);

    const abstractNode =
        get(meta, ["abstract"]) ??
        // sometimes multiple abstracts
        (Array.isArray(meta?.abstract) ? meta.abstract : null);

    const abstractParagraphs = extractAbstractParagraphs(abstractNode);
    const abstract =
        abstractParagraphs.length === 0
            ? null
            : abstractParagraphs.length === 1
            ? abstractParagraphs[0]
            : abstractParagraphs;

    const date = formatPubDate(selectBestJatsDate(meta));

    return {
        pmcid,
        title: emptyToNull(title),
        authors,
        abstract,
        date,
    };
}

function extractJatsAuthors(meta: any): string[] {
    // JATS: article-meta > contrib-group > contrib[contrib-type="author"]
    // Each contrib may have <name><surname>, <given-names> OR <string-name>
    const names: string[] = [];
    const contribGroup =
        get(meta, ["contrib-group"]) ??
        (Array.isArray(meta?.["contrib-group"])
            ? meta["contrib-group"][0]
            : null);

    if (!contribGroup) return names;

    const contribs = ensureArray(contribGroup.contrib ?? []);
    for (const c of contribs) {
        const ctype = c?.["contrib-type"] ?? c?.contribType;
        if (ctype && ctype !== "author") continue;

        const name = c?.name ?? get(c, ["name"]);
        if (name) {
            const given = extractText(
                name["given-names"] ?? name["givenNames"]
            );
            const sur = extractText(name["surname"]);
            const full = joinName(given, sur);
            if (full) names.push(full);
            continue;
        }

        const stringName = extractText(c?.["string-name"] ?? c?.stringName);
        if (stringName) {
            names.push(stringName);
            continue;
        }

        // Sometimes <collab> for group author
        const collab = extractText(c?.collab);
        if (collab) names.push(collab);
    }

    return names;
}

function selectBestJatsDate(meta: any): {
    year?: number;
    month?: string | number;
    day?: number;
} | null {
    // Prefer pub-date@pub-type epub -> ppub -> first
    const pubDates = ensureArray(meta?.["pub-date"] ?? meta?.pubDate ?? []);
    if (pubDates.length === 0) return null;

    const score = (d: any) => {
        const t = (d?.["pub-type"] ?? d?.pubType ?? "").toLowerCase();
        if (t === "epub") return 3;
        if (t === "ppub") return 2;
        return 1;
    };

    pubDates.sort((a, b) => score(b) - score(a));
    const best = pubDates[0];

    const y = toInt(extractText(best?.year));
    const mRaw = extractText(best?.month);
    const d = toInt(extractText(best?.day));

    return {
        year: y ?? undefined,
        month: mRaw ?? undefined,
        day: d ?? undefined,
    };
}

function findArticleId(meta: any, type: string): string | null {
    const ids = ensureArray(meta?.["article-id"] ?? []);
    for (const id of ids) {
        const t = (id?.["pub-id-type"] ?? id?.pubIdType ?? "").toLowerCase();
        const val = extractText(id);
        if (!val) continue;
        if (t === type.toLowerCase()) return val;
        if (!t && val.toLowerCase().startsWith(type.toLowerCase())) return val;
    }
    return null;
}

/* ------------------------- Mappers (PubMed) -------------------------- */

function mapPubMedArticle(node: any): ArticleSummary {
    const med = node?.MedlineCitation ?? get(node, ["MedlineCitation"]);
    const art = med?.Article ?? get(med, ["Article"]) ?? node?.Article;

    // PMCID may be in PubmedData > ArticleIdList > ArticleId (IdType="pmc")
    const pmcid = normalizePmcId(
        findPubMedId(node, "pmc") ?? findPubMedId(node, "pmcid")
    );

    const title = textify(art?.ArticleTitle);

    const authors = extractPubMedAuthors(art);

    const abstractNode = art?.Abstract?.AbstractText;
    const abstractParagraphs = extractAbstractParagraphs(abstractNode);
    const abstract =
        abstractParagraphs.length === 0
            ? null
            : abstractParagraphs.length === 1
            ? abstractParagraphs[0]
            : abstractParagraphs;

    const date = formatPubDate(selectBestPubMedDate(art, med, node));

    return {
        pmcid,
        title: emptyToNull(title),
        authors,
        abstract,
        date,
    };
}

function extractPubMedAuthors(art: any): string[] {
    const names: string[] = [];
    const list = art?.AuthorList?.Author;
    const arr = ensureArray(list ?? []);
    for (const a of arr) {
        const fore = extractText(a?.ForeName) ?? extractText(a?.GivenName);
        const last = extractText(a?.LastName) ?? extractText(a?.Surname);
        const collab = extractText(a?.CollectiveName);
        const full = collab || joinName(fore, last);
        if (full) names.push(full);
    }
    return names;
}

function findPubMedId(node: any, type: string): string | null {
    const ids = ensureArray(
        node?.PubmedData?.ArticleIdList?.ArticleId ??
            get(node, ["PubmedData", "ArticleIdList", "ArticleId"]) ??
            []
    );
    for (const id of ids) {
        const idType = (id?.IdType ?? id?.idtype ?? "").toLowerCase();
        const val = extractText(id);
        if (!val) continue;
        if (idType === type.toLowerCase()) return val;
        if (!idType && val.toLowerCase().startsWith(type.toLowerCase()))
            return val;
    }
    return null;
}

function selectBestPubMedDate(
    art: any,
    med: any,
    root: any
): { year?: number; month?: string | number; day?: number } | null {
    // Prefer ArticleDate (EPublish) then Journal PubDate then PubMedPubDate
    const ad = ensureArray(art?.ArticleDate ?? []);
    if (ad.length > 0) {
        const best = pickBestByType(ad, "epublish", "epub");
        const y = toInt(extractText(best?.Year));
        const m = extractText(best?.Month);
        const d = toInt(extractText(best?.Day));
        return {
            year: y ?? undefined,
            month: m ?? undefined,
            day: d ?? undefined,
        };
    }

    const jd = med?.Article?.Journal?.JournalIssue?.PubDate;
    if (jd) {
        const y = toInt(extractText(jd?.Year));
        const m = extractText(jd?.Month);
        const d = toInt(extractText(jd?.Day));
        return {
            year: y ?? undefined,
            month: m ?? undefined,
            day: d ?? undefined,
        };
    }

    const pmd = ensureArray(root?.PubmedData?.History?.PubMedPubDate ?? []);
    if (pmd.length > 0) {
        const best = pickBestByType(
            pmd,
            "epublish",
            "entrez",
            "pubmed",
            "medline"
        );
        const y = toInt(extractText(best?.Year));
        const m = extractText(best?.Month);
        const d = toInt(extractText(best?.Day));
        return {
            year: y ?? undefined,
            month: m ?? undefined,
            day: d ?? undefined,
        };
    }

    return null;
}

function pickBestByType(arr: any[], ...types: string[]): any {
    const tset = types.map((t) => t.toLowerCase());
    for (const t of tset) {
        const found = arr.find(
            (x) =>
                (x?.["PubStatus"] ?? x?.["DateType"] ?? x?.["pub-type"] ?? "")
                    .toString()
                    .toLowerCase() === t
        );
        if (found) return found;
    }
    return arr[0];
}

/* ---------------------------- Utilities ------------------------------ */

function safeParse(xml: string): any | null {
    try {
        return parser.parse(xml);
    } catch {
        return null;
    }
}

function get(obj: any, path: (string | number)[]): any | null {
    let cur = obj;
    for (const k of path) {
        if (cur == null) return null;
        cur = cur[k as any];
    }
    return cur ?? null;
}

function ensureArray<T>(x: T | T[] | null | undefined): T[] {
    if (x == null) return [];
    return Array.isArray(x) ? x : [x];
}

function findNodesByTag(root: any, tag: string): any[] {
    const out: any[] = [];
    const walk = (node: any) => {
        if (node == null) return;
        if (typeof node !== "object") return;
        for (const k of Object.keys(node)) {
            const v = node[k];
            if (k === tag && v) {
                const arr = ensureArray(v);
                for (const a of arr) out.push(a);
            } else if (typeof v === "object") {
                walk(v);
            }
        }
    };
    walk(root);
    return out;
}

function findLikelyArticleNodes(root: any): any[] {
    // Best effort: nodes that have 'article-meta' or 'front'
    const out: any[] = [];
    const walk = (node: any) => {
        if (node == null || typeof node !== "object") return;
        if (node["article-meta"] || node["front"]) {
            out.push(node);
        }
        for (const v of Object.values(node)) {
            if (typeof v === "object") walk(v);
        }
    };
    walk(root);
    return out;
}

function extractText(x: any): string | null {
    if (x == null) return null;
    if (typeof x === "string") return x.trim() || null;
    if (typeof x === "number") return String(x);
    if (typeof x === "boolean") return String(x);
    if (typeof x === "object") {
        // fast-xml-parser sometimes uses '#text' for node text
        const t =
            x["#text"] ??
            x["_text"] ??
            null ??
            // try to flatten a bit
            null;
        if (t != null) {
            return typeof t === "string" ? t.trim() || null : extractText(t);
        }
        // If object, try concatenating string leaves
        const parts: string[] = [];
        for (const v of Object.values(x)) {
            const s = extractText(v);
            if (s) parts.push(s);
        }
        return parts.join(" ").trim() || null;
    }
    return null;
}

function textify(x: any): string | null {
    const s = extractText(x);
    return s ? normalizeWhitespace(s) : null;
}

function normalizeWhitespace(s: string): string {
    return s.replace(/\s+/g, " ").trim();
}

function joinName(
    given?: string | null,
    family?: string | null
): string | null {
    const g = given ? normalizeWhitespace(given) : "";
    const f = family ? normalizeWhitespace(family) : "";
    const full = `${g} ${f}`.trim();
    return full || null;
}

function normalizePmcId(raw: string | null): string | null {
    if (!raw) return null;
    const s = raw.toString().trim();
    const digits = s.replace(/^PMC/i, "").replace(/\D/g, "");
    return digits || null;
}

function extractAbstractParagraphs(abs: any): string[] {
    const paragraphs: string[] = [];

    const push = (val: string | null) => {
        if (val) {
            const cleaned = normalizeWhitespace(val);
            if (cleaned) paragraphs.push(cleaned);
        }
    };

    const collect = (node: any) => {
        if (node == null) return;
        if (typeof node === "string") {
            push(node);
            return;
        }
        if (Array.isArray(node)) {
            for (const n of node) collect(n);
            return;
        }
        if (typeof node === "object") {
            // Prefer <p> if present
            if (node.p != null) {
                const pArr = ensureArray(node.p);
                for (const p of pArr) push(textify(p));
            } else if (node["sec"] != null) {
                const secs = ensureArray(node["sec"]);
                for (const s of secs) collect(s);
            } else if (node["AbstractText"] != null) {
                const aArr = ensureArray(node["AbstractText"]);
                for (const a of aArr) push(textify(a));
            } else {
                // Fallback: flatten anything textual here
                const t = textify(node);
                if (t) push(t);
            }
        }
    };

    collect(abs);
    // De-dup consecutive identical paragraphs
    const out: string[] = [];
    for (const p of paragraphs) {
        if (out.length === 0 || out[out.length - 1] !== p) out.push(p);
    }
    return out;
}

function toInt(s: string | null | undefined): number | null {
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
}

function formatPubDate(
    d: {
        year?: number;
        month?: string | number;
        day?: number;
    } | null
): string | null {
    if (!d || !d.year) return null;

    const m = normalizeMonth(d.month);
    const day = d.day ?? null;

    if (m && day != null) return `${d.year} ${m} ${day}`;
    if (m) return `${d.year} ${m}`;
    return `${d.year}`;
}

function normalizeMonth(m?: string | number): string | null {
    if (m == null) return null;
    const mm =
        typeof m === "number"
            ? m
            : /^[0-9]+$/.test(m)
            ? parseInt(m, 10)
            : monthAbbrevToNum(m) ?? m;
    if (typeof mm === "number" && Number.isFinite(mm)) {
        return numToMonth(mm);
    }
    // If already an abbreviation or name, coerce to 3-letter cap
    const ab = toMonthAbbrev(m.toString());
    return ab ?? null;
}

function monthAbbrevToNum(s: string): number | null {
    const map: Record<string, number> = {
        jan: 1,
        feb: 2,
        mar: 3,
        apr: 4,
        may: 5,
        jun: 6,
        jul: 7,
        aug: 8,
        sep: 9,
        sept: 9,
        oct: 10,
        nov: 11,
        dec: 12,
    };
    const key = s.trim().toLowerCase();
    return map[key] ?? null;
}

function numToMonth(n: number): string {
    const arr = [
        "",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ];
    if (n >= 1 && n <= 12) return arr[n];
    return null as any;
}

function toMonthAbbrev(s: string): string | null {
    const n = monthAbbrevToNum(s);
    return n ? numToMonth(n) : null;
}

function emptyToNull(s: string | null): string | null {
    return s && s.trim() ? s : null;
}

function dedupeBy<T>(arr: T[], keyFn: (t: T) => string | null): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const x of arr) {
        const k = keyFn(x);
        if (!k) {
            out.push(x);
            continue;
        }
        if (!seen.has(k)) {
            seen.add(k);
            out.push(x);
        }
    }
    return out;
}

/* ------------------------------ Example ------------------------------ */
// Usage:
// const xml = await res.text();
// const articles = parseArticlesFromXml(xml);
// console.log(articles);
