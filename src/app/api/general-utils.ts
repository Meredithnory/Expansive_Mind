import {
    AbstractSection,
    ArticleID,
    Contributor,
    PubDate,
    RawArticle,
    FormattedArticle,
    AbstractParagraph,
    RelatedResearchArticle,
} from "./general-interfaces";
import {
    DOMParser,
    type Element as XmlElement,
} from "@xmldom/xmldom";

type Element = XmlElement;

const MONTH_NAMES: Record<string, string> = {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "May",
    6: "Jun",
    7: "Jul",
    8: "Aug",
    9: "Sep",
    10: "Oct",
    11: "Nov",
    12: "Dec",
};
const convertMonthToName = (monthNum: string): string => {
    const name = MONTH_NAMES[monthNum];

    if (!name) {
        return String(monthNum);
    }

    return name;
};

const extractAbstractText = (
    abstractSectionOrSections:
        | AbstractSection[]
        | AbstractSection
        | { sec: AbstractSection[] | AbstractSection }
        | { p: AbstractParagraph[] | AbstractParagraph }
        | undefined,
): string => {
    if (!abstractSectionOrSections) {
        return "";
    }

    let sections:
        | AbstractSection[]
        | AbstractSection
        | { sec: AbstractSection[] | AbstractSection }
        | { p: AbstractParagraph[] | AbstractParagraph } = abstractSectionOrSections;

    if (Array.isArray(sections) && !("title" in sections)) {
        sections = sections[0];
    }

    if ("sec" in sections) {
        sections = sections.sec;
    }

    if (Array.isArray(sections)) {
        const firstAbstractText = sections.find((abstractSec) => abstractSec.p);
        if (!firstAbstractText) {
            return "";
        }

        if (Array.isArray(firstAbstractText)) {
            return firstAbstractText[0]?._text || "";
        }

        if (Array.isArray(firstAbstractText.p)) {
            return firstAbstractText.p[0]?._text || "";
        }

        return firstAbstractText.p?._text || "";
    }

    if (!sections.p) {
        return "";
    }

    if (Array.isArray(sections.p)) {
        return sections.p[0]?._text || "";
    }

    return sections.p._text || "";
};

//Function to extract the data from the NIH PMC API
export const extractArticleDetails = (
    article: RawArticle
): FormattedArticle | null => {
    let foundArticleIdObj: ArticleID | undefined;

    const articleIdOrIds: ArticleID[] | ArticleID =
        article.front["article-meta"]["article-id"];
    if (Array.isArray(articleIdOrIds)) {
        foundArticleIdObj = articleIdOrIds.find(
            (article) => article._attributes["pub-id-type"] === "pmcaid"
        );
    } else {
        //This is the case of a single article ID object
        if (articleIdOrIds._attributes["pub-id-type"] === "pmcaid") {
            //Setting it equal the found article ID obj
            foundArticleIdObj = articleIdOrIds;
        } else {
            //If it does not include a pmcaid then set to undefined
            foundArticleIdObj = undefined;
        }
    }
    //If no article is found with the pmcaid then we return null
    if (!foundArticleIdObj) {
        return null;
    }
    ///////////////Find ID /////////////////////////
    let pmcid = foundArticleIdObj._text;
    //////////////Find the title//////////////////
    let title =
        article.front["article-meta"]["title-group"]["article-title"]._text;
    if (Array.isArray(title)) {
        title = title.join("");
    }

    const abstract = extractAbstractText(
        article.front["article-meta"].abstract,
    );
    ///////////Find the authors////////////////////
    let contribGroup:
        | { contrib: Contributor[] | Contributor }
        | { contrib: Contributor[] | Contributor }[] =
        article.front["article-meta"]["contrib-group"];

    let authorOrAuthors: Contributor | Contributor[] | undefined;

    if (Array.isArray(contribGroup)) {
        const foundContrib = contribGroup.find((groupOrSingle) => {
            let contribType: string;
            const contribOrContribs = groupOrSingle.contrib;

            if (Array.isArray(contribOrContribs)) {
                contribType = contribOrContribs[0]._attributes["contrib-type"];
            } else {
                contribType = contribOrContribs._attributes["contrib-type"];
            }
            return contribType === "author";
        });
        authorOrAuthors = foundContrib?.contrib;
    } else {
        authorOrAuthors = contribGroup.contrib;
    }
    if (!authorOrAuthors) {
        return null;
    }

    let formattedAuthors: string[] = [];

    if (Array.isArray(authorOrAuthors)) {
        for (let author of authorOrAuthors) {
            if (author._attributes["contrib-type"] === "author") {
                if (
                    !author.name ||
                    !author.name["given-names"] ||
                    !author.name.surname
                ) {
                    continue;
                }
                formattedAuthors.push(
                    author.name["given-names"]._text +
                        " " +
                        author.name.surname._text
                );
            }
        }
    } else if (
        authorOrAuthors.name["given-names"] &&
        authorOrAuthors.name.surname
    ) {
        formattedAuthors.push(
            authorOrAuthors.name["given-names"]._text +
                " " +
                authorOrAuthors.name.surname._text
        );
    }
    /////////////Find the date//////////////////
    let dateOrDates: PubDate[] | PubDate =
        article.front["article-meta"]["pub-date"];
    let foundDateObj: PubDate | undefined;
    if (Array.isArray(dateOrDates)) {
        foundDateObj = dateOrDates.find(
            (date) => date._attributes["pub-type"] === "epub"
        );
        //If we can't find a date that is equal to epub then put date that is found within pub-date, set to default date
        if (!foundDateObj) {
            foundDateObj = dateOrDates[0];
        }
    } else {
        //If dateOrDates is not an arr, then set it equal to the only available pub-date on paper
        foundDateObj = dateOrDates;
    }

    let formattedDate = foundDateObj.year._text;
    if (foundDateObj.month) {
        formattedDate += " " + convertMonthToName(foundDateObj.month._text);
        if (foundDateObj.day) {
            formattedDate += " " + foundDateObj.day._text;
        }
    }

    return {
        pmcid,
        title,
        authors: formattedAuthors,
        abstract: abstract,
        date: formattedDate,
    };
};

const NOTICE_ARTICLE_TYPES = new Set(["correction", "erratum"]);

const normalizePmcId = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const digits = raw.toString().trim().replace(/^PMC/i, "").replace(/\D/g, "");
    return digits || null;
};

const getRelatedArticlePmcid = (node: Element): string | null => {
    const href =
        node.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
        node.getAttribute("xlink:href");
    const hrefPmcid = normalizePmcId(href);
    if (hrefPmcid) return hrefPmcid;

    const pubIds = Array.from(node.getElementsByTagName("pub-id"));
    for (const pubId of pubIds) {
        if (pubId.getAttribute("pub-id-type") === "pmcid") {
            const pmcid = normalizePmcId(pubId.textContent);
            if (pmcid) return pmcid;
        }
    }

    return null;
};

export const extractRelatedResearchArticle = (
    xmlString: string,
): RelatedResearchArticle | null => {
    const doc = new DOMParser().parseFromString(xmlString, "application/xml");
    const article = doc.getElementsByTagName("article")[0];
    if (!article) return null;

    const noticeType = article.getAttribute("article-type") || "";
    if (!NOTICE_ARTICLE_TYPES.has(noticeType)) {
        return null;
    }

    const relatedArticles = Array.from(
        doc.getElementsByTagName("related-article"),
    );
    if (relatedArticles.length === 0) return null;

    const preferredType =
        noticeType === "correction" ? "corrected-article" : "corrected-article";
    const related =
        relatedArticles.find(
            (node) => node.getAttribute("related-article-type") === preferredType,
        ) || relatedArticles[0];

    const pmcid = getRelatedArticlePmcid(related);
    if (!pmcid) return null;

    const titleNode = related.getElementsByTagName("article-title")[0];
    const title = titleNode?.textContent?.trim() || "Related research article";

    return {
        pmcid,
        title,
        noticeType: noticeType as RelatedResearchArticle["noticeType"],
    };
};

