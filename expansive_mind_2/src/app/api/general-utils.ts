import {
    AbstractSection,
    ArticleID,
    Contributor,
    PubDate,
    RawArticle,
    FormattedArticle,
    AbstractParagraph,
} from "./general-interfaces";

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

//Function to extract the data from the NIH PMC API
export const extractArticleDetails = (
    article: RawArticle
): FormattedArticle | null => {
    const publicationType = article._attributes["article-type"];

    if (
        publicationType !== "research-article" ||
        !article.front["article-meta"].abstract
    ) {
        {
            return null;
        }
    }
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

    ////////////Find the abstract////////////////
    let abstractSectionOrSections:
        | AbstractSection[]
        | AbstractSection
        | { sec: AbstractSection[] | AbstractSection }
        | { p: AbstractParagraph[] | AbstractParagraph } =
        article.front["article-meta"].abstract;

    if (
        Array.isArray(abstractSectionOrSections) &&
        !("title" in abstractSectionOrSections)
    ) {
        abstractSectionOrSections = abstractSectionOrSections[0];
    }
    //If the key "sec" exists in the object then drill into it more
    if ("sec" in abstractSectionOrSections) {
        abstractSectionOrSections = abstractSectionOrSections.sec;
    }
    let abstract: string;
    if (Array.isArray(abstractSectionOrSections)) {
        const firstAbstractText = abstractSectionOrSections.find(
            (abstractSec) => abstractSec.p
        );
        if (!firstAbstractText) {
            return null;
        }

        if (Array.isArray(firstAbstractText)) {
            abstract = firstAbstractText[0]._text;
        } else {
            if (Array.isArray(firstAbstractText.p)) {
                abstract = firstAbstractText.p[0]._text;
            } else {
                abstract = firstAbstractText.p._text;
            }
        }
    } else {
        if (Array.isArray(abstractSectionOrSections.p)) {
            abstract = abstractSectionOrSections.p[0]._text;
        } else {
            abstract = abstractSectionOrSections.p._text;
        }
    }
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
