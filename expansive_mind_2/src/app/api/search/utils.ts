import convert from "xml-js";
import { convertMonthToName } from "../general-utils";
//Base URL and NIH KEY
const NIH_API_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const NIH_API_KEY = process.env.API_KEY;

//Pass in a search Value or keywords to this function to handle the search of the paper IDs that match that keyword/search value
export const searchNIHPaperIds = async (searchValue: string) => {
    if (!NIH_API_KEY) {
        throw Error("Invalid API Key");
    }
    //Appending paraments to the params, these params are given from the documentation of PMC
    const params = new URLSearchParams();
    params.append("db", "pmc");
    params.append("api_key", NIH_API_KEY);
    params.append("term", `"${searchValue}"[Title]`);
    params.append("retmax", "25");

    //We are using the esearch to search for data in the db of Pubmed
    const res = await fetch(`${NIH_API_URL}/esearch.fcgi?${params}`);
    const data = await res.text();

    const dataAsJSON = JSON.parse(convert.xml2json(data, { compact: true }));
    const articleOrArticles = dataAsJSON.eSearchResult.IdList.Id;

    //From the data recieved we want an ID list of the papers that match the query
    if (!articleOrArticles) {
        return [];
    } else if (!Array.isArray(articleOrArticles)) {
        return [articleOrArticles._text];
    }

    return articleOrArticles.map((a) => a._text);
};
interface AbstractSection {
    title: { _text: string };
    p: { _text: string };
}
interface ArticleID {
    _attributes: {
        "pub-id-type": string;
    };
    _text: string;
}
interface Contributor {
    _attributes: {
        "contrib-type": string;
    };
    name: {
        surname: { _text: string };
        "given-names": { _text: string };
    };
}
interface PubDate {
    _attributes: {
        "pub-type": string;
    };
    day: { _text: string };
    month: { _text: string };
    year: { _text: string };
}
//Interface for taking in raw article from NIH PMC API
interface RawArticle {
    _attributes: {
        "article-type": string;
    };
    "processing-meta": {};
    front: {
        "article-meta": {
            "article-id": ArticleID[] | ArticleID;
            "title-group": {
                "article-title": {
                    _text: string;
                };
            };
            "contrib-group":
                | {
                      contrib: Contributor[] | Contributor;
                  }
                | {
                      contrib: Contributor[] | Contributor;
                  }[];
            "pub-date": PubDate[] | PubDate;
            abstract:
                | {
                      sec: AbstractSection[] | AbstractSection;
                  }
                | AbstractSection[]
                | AbstractSection;
        };
    };
    body: {};
    back: {};
}
//Interface for formatted article from raw article PMC API
interface FormattedArticle {
    pmid: string;
    title: string;
    authors: string[];
    abstract: string;
    date: string;
}
//Function to extract the data from the NIH PMC API
const extractArticleDetails = (
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
    let pmid = foundArticleIdObj._text;
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
        | { sec: AbstractSection[] | AbstractSection } =
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
        abstract = firstAbstractText.p._text;
    } else {
        abstract = abstractSectionOrSections.p._text;
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
        pmid,
        title,
        authors: formattedAuthors,
        abstract,
        date: formattedDate,
    };
};
//Now we will pass the the idList into this function to extract the data that contains the papers
export const getNIHPaperResults = async (idList: string[]) => {
    if (!NIH_API_KEY) {
        throw Error("Invalid API Key");
    }
    const params = new URLSearchParams();
    params.append("db", "pmc");
    params.append("id", idList.join(","));

    const res = await fetch(`${NIH_API_URL}/efetch.fcgi?${params}`);
    //PMC DB will be in XML format as default b/c it is not in JSON, (either JSON or TEXT (all fallback which includes XML, HTML, plain text))
    const data = await res.text();

    //Converting the data as JSON, gave options and chose XML format
    // so that it could be easier to convert it to JSON by using a package and making it compact so that we don't need to drill elements each time
    const dataAsJSON = JSON.parse(convert.xml2json(data, { compact: true }));
    //Drilling to get a list or a single article
    const articleOrArticles = dataAsJSON["pmc-articleset"].article;
    //Empty arr that will be pushing formated articles in
    const formattedArticles: FormattedArticle[] = [];
    //Handle edge case in case if article is an array of articles or there is a single article to be put inside the formatted articles arr
    if (Array.isArray(articleOrArticles)) {
        for (let article of articleOrArticles) {
            const articleData: FormattedArticle | null =
                extractArticleDetails(article);
            if (articleData) {
                formattedArticles.push(articleData);
            }
        }
    } else {
        const articleData: FormattedArticle | null =
            extractArticleDetails(articleOrArticles);
        if (articleData) {
            formattedArticles.push(articleData);
        }
    }

    return formattedArticles;
};
