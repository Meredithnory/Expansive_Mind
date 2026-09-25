import {
    DOMParser,
    type Document as XmlDocument,
    type Element as XmlElement,
} from "@xmldom/xmldom";

type Document = XmlDocument;
type Element = XmlElement;

export interface RawLicenseInfo {
    rawLicense: string | null;
    licenseUrl: string | null;
    copyrightStatement: string | null;
}

function firstText(doc: Document, tagNames: string[]): string | null {
    for (const tagName of tagNames) {
        const value = doc
            .getElementsByTagName(tagName)[0]
            ?.textContent?.replace(/\s+/g, " ")
            .trim();
        if (value) return value;
    }
    return null;
}

export function extractLicenseFromJatsXml(xml: string): RawLicenseInfo {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const license = doc.getElementsByTagName("license")[0] as
        | Element
        | undefined;
    const licenseRef =
        firstText(doc, ["ali:license_ref", "license_ref"]) ||
        license?.getAttributeNS(
            "http://www.w3.org/1999/xlink",
            "href",
        ) ||
        license?.getAttribute("xlink:href") ||
        null;
    const licenseText =
        firstText(doc, ["license-p"]) ||
        license?.textContent?.replace(/\s+/g, " ").trim() ||
        null;

    return {
        rawLicense: licenseText || licenseRef,
        licenseUrl: licenseRef,
        copyrightStatement: firstText(doc, ["copyright-statement"]),
    };
}

export function extractDoiFromJatsXml(xml: string): string | null {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const ids = Array.from(doc.getElementsByTagName("article-id"));
    for (const node of ids) {
        const element = node as Element;
        if (element.getAttribute("pub-id-type")?.toLowerCase() === "doi") {
            return element.textContent?.trim() || null;
        }
    }
    return null;
}

export function hasParserError(xml: string): boolean {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return doc.getElementsByTagName("parsererror").length > 0;
}
