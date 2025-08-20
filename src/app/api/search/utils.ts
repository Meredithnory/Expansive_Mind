import convert from "xml-js";
import { FormattedArticle } from "../general-interfaces";
import { extractArticleDetails } from "../general-utils";
import { writeFile } from "fs/promises";
import { parseArticlesFromXml } from "../articleParser";
//Base URL and NIH KEY
const NIH_API_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const NIH_API_KEY = process.env.API_KEY;

//Pass in a search Value or keywords to this function to handle the search of the paper IDs that match that keyword/search value
export const searchNIHPaperIds = async (
    searchValue: string,
    page: number = 0
) => {
    if (!NIH_API_KEY) {
        throw Error("Invalid API Key");
    }
    //loop results in chunks of retmax to be 25
    const RETMAX = 10;
    const retstart = page * RETMAX;

    //Appending paraments to the params, these params are given from the documentation of PMC
    const params = new URLSearchParams();
    params.append("db", "pmc");
    params.append("api_key", NIH_API_KEY);
    params.append("term", `"${searchValue}"[Title]`);
    params.append("retmax", RETMAX.toString());
    params.append("retstart", retstart.toString());
    params.append("usehistory", "y");
    params.append("sort", "pubdate");

    //We are using the esearch to search/fetch for data in the db of Pubmed
    const res = await fetch(`${NIH_API_URL}/esearch.fcgi?${params}`);
    const data = await res.text();

    const dataAsJSON = JSON.parse(convert.xml2json(data, { compact: true }));

    //Total number of pages (for UI pagination display)
    const totalCount = parseInt(dataAsJSON.eSearchResult.Count._text, 10);

    //Extract IDs for this page
    const articleOrArticles = dataAsJSON.eSearchResult.IdList.Id;
    let ids: string[] = [];
    if (!articleOrArticles) {
        ids = [];
    } else if (!Array.isArray(articleOrArticles)) {
        ids = [articleOrArticles._text];
    } else {
        ids = articleOrArticles.map((a: any) => a._text);
    }
    return {
        totalCount,
        ids,
        page,
        totalPages: Math.ceil(totalCount / RETMAX),
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
    const articles = parseArticlesFromXml(data);
    //Sort by date
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));
    return articles;

    // await writeFile("output.xml", data, "utf8");

    //Converting the data as JSON, gave options and chose XML format
    // so that it could be easier to convert it to JSON by using a package and making it compact so that we don't need to drill elements each time
    const dataAsJSON = JSON.parse(convert.xml2json(data, { compact: true }));
    //Drilling to get a list or a single article
    let articleOrArticles = dataAsJSON["pmc-articleset"].article;
    //Empty arr that will be pushing formated articles in
    const formattedArticles: FormattedArticle[] = [];
    //Handle edge case in case if article is an array of articles or there is a single article to be put inside the formatted articles arr
    if (!Array.isArray(articleOrArticles)) {
        articleOrArticles = [articleOrArticles];
    }

    for (let article of articleOrArticles) {
        const articleData: FormattedArticle | null =
            extractArticleDetails(article);
        if (articleData) {
            formattedArticles.push(articleData);
        }
    }

    await writeFile("desired.txt", JSON.stringify(formattedArticles), "utf8");
    return formattedArticles;
};
