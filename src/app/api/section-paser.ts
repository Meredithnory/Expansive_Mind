// sectionParser.ts

import { DOMParser } from "xmldom";
import { Section, SubSection } from "./general-interfaces";

/**
 * Parse JATS XML into:
 *  • one Section per direct-child <sec> of <body>
 *  • one Section per <abstract> in front (titled by abstract-type)
 * Each Section has a flat array of SubSection (never nested deeper).
 * Figures are only attached to SubSections.
 */
export function parseArticleXml(
    xmlString: string,
    getImageSrc: (id: string) => string
): Section[] {
    const doc = new DOMParser().parseFromString(xmlString, "application/xml");
    const out: Section[] = [];
    const text = (n: Node | null) => n?.textContent?.trim() || "";

    // Extract first <fig> under this element for a SubSection
    function extractFigData(el: Element) {
        const fig = el.getElementsByTagName("fig")[0];
        if (!fig) return {};
        const data: {
            graphicSrc?: string;
            graphicTitle?: string;
            graphicContent?: string;
        } = {};

        // <label>
        const lbl = fig.getElementsByTagName("label")[0];
        const labelText = lbl ? text(lbl) : "";

        // <caption><title>
        const cap = fig.getElementsByTagName("caption")[0];
        let capTitle = "";
        if (cap) {
            const ct = cap.getElementsByTagName("title")[0];
            if (ct) capTitle = text(ct);
            // caption paragraphs
            const paras = Array.from(cap.getElementsByTagName("p"))
                .map(text)
                .filter(Boolean);
            if (paras.length) data.graphicContent = paras.join("\n\n");
        }

        // graphic -> src
        const g = fig.getElementsByTagName("graphic")[0];
        if (g) {
            const id = g.getAttribute("id");
            if (id) data.graphicSrc = getImageSrc(id);
        }

        // build title: "Fig. X. CaptionTitle"
        if (labelText || capTitle) {
            const prefix = labelText.endsWith(".")
                ? labelText
                : labelText + ".";
            data.graphicTitle = prefix + " " + capTitle;
        }

        return data;
    }

    // parse a second-level <sec> into SubSection
    function parseSubSection(secEl: Element): SubSection {
        // direct-title
        const titleEl = Array.from(secEl.childNodes).find(
            (n) => n.nodeType === 1 && (n as Element).tagName === "title"
        ) as Element;
        const title = text(titleEl || null);

        // direct <p> content
        const content = Array.from(secEl.childNodes)
            .filter((n) => n.nodeType === 1 && (n as Element).tagName === "p")
            .map((n) => text(n))
            .filter(Boolean)
            .join("\n\n");

        return { title, content, ...extractFigData(secEl) };
    }

    // parse a top-level <sec> into Section
    function parseSection(secEl: Element): Section {
        // direct-title
        const titleEl = Array.from(secEl.childNodes).find(
            (n) => n.nodeType === 1 && (n as Element).tagName === "title"
        ) as Element;
        const title = text(titleEl || null);

        // direct <p> content
        const content = Array.from(secEl.childNodes)
            .filter((n) => n.nodeType === 1 && (n as Element).tagName === "p")
            .map((n) => text(n))
            .filter(Boolean)
            .join("\n\n");

        // direct-child <sec> => subSections
        const subSections = Array.from(secEl.childNodes)
            .filter((n) => n.nodeType === 1 && (n as Element).tagName === "sec")
            .map((n) => parseSubSection(n as Element));

        return { title, content, subSections };
    }

    // 1) abstracts
    Array.from(doc.getElementsByTagName("abstract")).forEach((absEl) => {
        const kind = absEl.getAttribute("abstract-type") || "Abstract";
        const content = Array.from(absEl.getElementsByTagName("p"))
            .map((p) => text(p))
            .filter(Boolean)
            .join("\n\n");
        out.push({ title: kind, content, subSections: [] });
    });

    // 2) each direct child <sec> under <body>
    const body = doc.getElementsByTagName("body")[0];
    if (body) {
        Array.from(body.childNodes)
            .filter((n) => n.nodeType === 1 && (n as Element).tagName === "sec")
            .forEach((n) => out.push(parseSection(n as Element)));
    }

    return out;
}
