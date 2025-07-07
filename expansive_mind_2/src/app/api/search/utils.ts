import convert from "xml-js";
import { FormattedArticle } from "../general-interfaces";
import { extractArticleDetails } from "../general-utils";
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

    return formattedArticles;
};
