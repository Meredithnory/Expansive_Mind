// sectionParser.ts

import {
    DOMParser,
    type Element as XmlElement,
    type Node as XmlNode,
} from "@xmldom/xmldom";
import { PaperFigure, Section, SubSection } from "./general-interfaces";

type Element = XmlElement;
type Node = XmlNode;

const WEB_IMAGE_REF = /\.(?:jpe?g|png|webp|gif)$/i;

/**
 * Parse JATS XML into:
 *  • one Section per direct-child <sec> of <body>
 *  • one Section per <abstract> in front (titled by abstract-type)
 * Each Section has a flat array of SubSection (never nested deeper).
 * Figures are preserved on their nearest section or subsection.
 * Figures stored in <floats-group> (common in PMC) are attached via xref
 * or collected into a trailing Figures section.
 */
export function parseArticleXml(
    xmlString: string,
    getImageSrc: (sourceRef: string) => string,
): Section[] {
    const doc = new DOMParser().parseFromString(xmlString, "application/xml");
    const out: Section[] = [];
    const text = (n: Node | null) => n?.textContent?.trim() || "";
    const localName = (el: Element) => el.tagName.replace(/^.*:/, "");
    const stableFigureId = (value: string) => {
        let hash = 2166136261;
        for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return `figure-${(hash >>> 0).toString(36)}`;
    };

    const directChildrenByTag = (el: Element, tag: string) =>
        Array.from(el.childNodes).filter(
            (node) =>
                node.nodeType === 1 &&
                localName(node as Element) === tag,
        ) as Element[];

    const attribute = (el: Element, ...names: string[]) => {
        for (const name of names) {
            const value =
                el.getAttribute(name) ||
                el.getAttributeNS?.(
                    "http://www.w3.org/1999/xlink",
                    name.replace(/^xlink:/, ""),
                );
            if (value) return value.trim();
        }
        return "";
    };

    const extractLicense = (fig: Element) => {
        const permissions = fig.getElementsByTagName("permissions")[0];
        if (!permissions) {
            return {
                rawLicense: undefined,
                licenseUrl: undefined,
                hasSeparateRights: false,
            };
        }
        const license = permissions.getElementsByTagName("license")[0];
        const copyright = permissions.getElementsByTagName(
            "copyright-statement",
        )[0];
        return {
            rawLicense: text(license) || text(copyright) || undefined,
            licenseUrl: license
                ? attribute(license, "xlink:href", "href") || undefined
                : undefined,
            hasSeparateRights: true,
        };
    };

    const pickSourceImageRef = (fig: Element) => {
        const refs = Array.from(fig.getElementsByTagName("graphic"))
            .map(
                (graphic) =>
                    attribute(graphic, "xlink:href", "href") ||
                    attribute(graphic, "id"),
            )
            .filter(Boolean);
        return refs.find((ref) => WEB_IMAGE_REF.test(ref)) || refs[0] || "";
    };

    const figureFromElement = (
        fig: Element,
        index: number,
        sectionTitle: string,
        subSectionTitle?: string,
    ): PaperFigure => {
        const label = text(fig.getElementsByTagName("label")[0]) ||
            `Figure ${index + 1}`;
        const caption = fig.getElementsByTagName("caption")[0];
        const captionTitle = caption
            ? text(caption.getElementsByTagName("title")[0])
            : "";
        const captionParagraphs = caption
            ? Array.from(caption.getElementsByTagName("p"))
                  .map(text)
                  .filter(Boolean)
            : [];
        const sourceImageRef = pickSourceImageRef(fig);
        const graphic = fig.getElementsByTagName("graphic")[0];
        const figureId =
            attribute(fig, "id") ||
            (graphic ? attribute(graphic, "id") : "") ||
            stableFigureId(
                sourceImageRef ||
                    `${sectionTitle}-${subSectionTitle || "section"}-${label}-${index + 1}`,
            );
        const rights = extractLicense(fig);

        return {
            id: figureId,
            label,
            ...(captionTitle ? { captionTitle } : {}),
            caption: captionParagraphs.join("\n\n"),
            ...(sourceImageRef ? { sourceImageRef } : {}),
            ...(sourceImageRef && getImageSrc(sourceImageRef)
                ? { imageUrl: getImageSrc(sourceImageRef) }
                : {}),
            sectionTitle,
            ...(subSectionTitle ? { subSectionTitle } : {}),
            ...rights,
            canAnalyzeSourceImage: false,
        };
    };

    function extractFigures(
        el: Element,
        sectionTitle: string,
        subSectionTitle?: string,
    ): PaperFigure[] {
        const figures: Element[] = [];
        const collect = (parent: Element) => {
            for (const child of Array.from(parent.childNodes)) {
                if (child.nodeType !== 1) continue;
                const element = child as Element;
                const tag = localName(element);
                if (
                    tag === "sec" ||
                    tag === "floats-group" ||
                    tag === "floats-wrap"
                ) {
                    continue;
                }
                if (tag === "fig") {
                    figures.push(element);
                    continue;
                }
                collect(element);
            }
        };
        collect(el);
        return figures.map((fig, index) =>
            figureFromElement(fig, index, sectionTitle, subSectionTitle),
        );
    }

    const collectFigRids = (el: Element) => {
        const ids = new Set<string>();
        const walk = (parent: Element) => {
            for (const child of Array.from(parent.childNodes)) {
                if (child.nodeType !== 1) continue;
                const element = child as Element;
                const tag = localName(element);
                if (tag === "sec") continue;
                if (tag === "xref") {
                    const refType = (
                        attribute(element, "ref-type") || ""
                    ).toLowerCase();
                    if (refType && refType !== "fig") {
                        walk(element);
                        continue;
                    }
                    for (const rid of (attribute(element, "rid") || "")
                        .split(/\s+/)
                        .filter(Boolean)) {
                        ids.add(rid);
                    }
                }
                walk(element);
            }
        };
        walk(el);
        return ids;
    };

    function legacyFigureFields(figures: PaperFigure[]) {
        const first = figures[0];
        if (!first) return {};
        const title = [first.label, first.captionTitle]
            .filter(Boolean)
            .join(". ");
        return {
            ...(first.imageUrl ? { graphicSrc: first.imageUrl } : {}),
            ...(title ? { graphicTitle: `${title}.` } : {}),
            ...(first.caption ? { graphicContent: first.caption } : {}),
        };
    }

    type ParsedSection = {
        section: Section;
        figRids: Set<string>;
        subFigRids: Set<string>[];
    };

    // parse a second-level <sec> into SubSection
    function parseSubSection(secEl: Element): SubSection {
        const titleEl = Array.from(secEl.childNodes).find(
            (n) => n.nodeType === 1 && localName(n as Element) === "title"
        ) as Element;
        const title = text(titleEl || null);

        const content = Array.from(secEl.childNodes)
            .filter((n) => n.nodeType === 1 && localName(n as Element) === "p")
            .map((n) => text(n))
            .filter(Boolean)
            .join("\n\n");

        return { title, content, figures: [], };
    }

    // parse a top-level <sec> into Section
    function parseSection(secEl: Element): ParsedSection {
        const titleEl = Array.from(secEl.childNodes).find(
            (n) => n.nodeType === 1 && localName(n as Element) === "title"
        ) as Element;
        const title = text(titleEl || null);

        const content = Array.from(secEl.childNodes)
            .filter((n) => n.nodeType === 1 && localName(n as Element) === "p")
            .map((n) => text(n))
            .filter(Boolean)
            .join("\n\n");

        const parsedSubs = directChildrenByTag(secEl, "sec").map((node) => {
            const subSection = parseSubSection(node);
            const figures = extractFigures(node, title, subSection.title);
            return {
                subSection: {
                    ...subSection,
                    figures,
                    ...legacyFigureFields(figures),
                },
                figRids: collectFigRids(node),
            };
        });
        const figures = extractFigures(secEl, title);

        return {
            section: {
                title,
                content,
                subSections: parsedSubs.map((item) => item.subSection),
                figures,
                ...legacyFigureFields(figures),
            },
            figRids: collectFigRids(secEl),
            subFigRids: parsedSubs.map((item) => item.figRids),
        };
    }

    const parsedSections: ParsedSection[] = [];

    // 1) abstracts
    Array.from(doc.getElementsByTagName("abstract")).forEach((absEl) => {
        const kind = absEl.getAttribute("abstract-type") || "Abstract";
        const content = Array.from(absEl.getElementsByTagName("p"))
            .map((p) => text(p))
            .filter(Boolean)
            .join("\n\n");
        const figures = extractFigures(absEl, kind);
        parsedSections.push({
            section: {
                title: kind,
                content,
                subSections: [],
                figures,
                ...legacyFigureFields(figures),
            },
            figRids: collectFigRids(absEl),
            subFigRids: [],
        });
    });

    // 2) body content — Springer Nature sometimes puts <p> directly under <body>
    const body = doc.getElementsByTagName("body")[0];
    if (body) {
        const directParagraphs = Array.from(body.childNodes)
            .filter((n) => n.nodeType === 1 && localName(n as Element) === "p")
            .map((n) => text(n))
            .filter(Boolean);
        const bodyFigures = extractFigures(body, "Article");
        if (directParagraphs.length > 0 || bodyFigures.length > 0) {
            parsedSections.push({
                section: {
                    title: "Article",
                    content: directParagraphs.join("\n\n"),
                    subSections: [],
                    figures: bodyFigures,
                    ...legacyFigureFields(bodyFigures),
                },
                figRids: collectFigRids(body),
                subFigRids: [],
            });
        }

        Array.from(body.childNodes)
            .filter((n) => n.nodeType === 1 && localName(n as Element) === "sec")
            .forEach((n) => parsedSections.push(parseSection(n as Element)));
    }

    const placedIds = new Set<string>();
    for (const parsed of parsedSections) {
        for (const figure of parsed.section.figures || []) {
            placedIds.add(figure.id);
        }
        for (const subSection of parsed.section.subSections) {
            for (const figure of subSection.figures || []) {
                placedIds.add(figure.id);
            }
        }
    }

    const unplaced: PaperFigure[] = [];
    Array.from(doc.getElementsByTagName("floats-group")).forEach((group) => {
        unplaced.push(...extractFigures(group, "Figures"));
    });
    Array.from(doc.getElementsByTagName("floats-wrap")).forEach((group) => {
        unplaced.push(...extractFigures(group, "Figures"));
    });

    const attachFigure = (figure: PaperFigure) => {
        if (placedIds.has(figure.id)) return true;
        for (const parsed of parsedSections) {
            for (const [index, subRids] of parsed.subFigRids.entries()) {
                if (!subRids.has(figure.id)) continue;
                const subSection = parsed.section.subSections[index];
                const placed = {
                    ...figure,
                    sectionTitle: parsed.section.title,
                    subSectionTitle: subSection.title,
                };
                subSection.figures = [...(subSection.figures || []), placed];
                Object.assign(subSection, legacyFigureFields(subSection.figures));
                placedIds.add(figure.id);
                return true;
            }
            if (parsed.figRids.has(figure.id)) {
                const placed = {
                    ...figure,
                    sectionTitle: parsed.section.title,
                };
                parsed.section.figures = [
                    ...(parsed.section.figures || []),
                    placed,
                ];
                Object.assign(
                    parsed.section,
                    legacyFigureFields(parsed.section.figures),
                );
                placedIds.add(figure.id);
                return true;
            }
        }
        return false;
    };

    const leftover: PaperFigure[] = [];
    for (const figure of unplaced) {
        if (!attachFigure(figure)) leftover.push(figure);
    }
    if (leftover.length > 0) {
        parsedSections.push({
            section: {
                title: "Figures",
                content: "",
                subSections: [],
                figures: leftover,
                ...legacyFigureFields(leftover),
            },
            figRids: new Set(),
            subFigRids: [],
        });
    }

    for (const parsed of parsedSections) {
        out.push(parsed.section);
    }

    return out;
}
