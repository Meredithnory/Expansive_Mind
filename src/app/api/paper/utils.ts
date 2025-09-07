import convert from "xml-js";
import {
    extractAllText,
    extractArticleDetails,
    saveXmlToRoot,
} from "../general-utils";
import {
    FormattedArticle,
    FormattedPaper,
    RawArticle,
    Section,
} from "../general-interfaces";
import { Cheerio, CheerioAPI, load as cheerioLoad } from "cheerio";
import {
    parseArticleXml,
    parseBack,
    parseDocument,
    parsePaper,
    parseSection,
} from "../section-paser";
//Base URL and NIH KEY
const NIH_API_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const NIH_API_KEY = process.env.API_KEY;
//Did seperate function b/c we will get html once and only need it once for to then send it into the getImageSrc function to get src and get multiple src ids, dont need to call html multiple times
const urlToHtml = async (url: string): Promise<CheerioAPI> => {
    const res = await fetch(url);
    const dataHTMLDocument = await res.text();
    //CheerioLoad will allows us to parse through the html content with different methods such as getting a src tag or a classname like a query selector
    const cheerioAPI = cheerioLoad(dataHTMLDocument);
    //CheerioLoad which has a class constructor that has methods we can use, therefore we will put a html doc inside the class constructor and we will have that instance with those methods
    return cheerioAPI;
};
//Pass in API and id of image to look for src in the html doc
const getImageSrc = (
    cheerioAPI: CheerioAPI,
    imageID: string
): string | null => {
    // Select the element and get its src
    const src = cheerioAPI(`#${imageID}`).attr("src") || null;
    return src;
};

//Function to get paper details from PMID passed into the function to get paper details
export const getPaperDetails = async (
    pmcid: string
): Promise<FormattedPaper | null> => {
    if (!NIH_API_KEY) {
        throw Error("Invalid API Key");
    }
    //Params
    const params = new URLSearchParams();
    params.append("id", pmcid);
    params.append("api_key", NIH_API_KEY);
    params.append("db", "pmc");
    const res = await fetch(`${NIH_API_URL}?${params}`);
    //Get data from NIH url and added params - only XML is returned in PMC /efetch url no JSON, ,so we need to handle that
    const dataAsXML = await res.text();

    // save to file as .xml for the papers raw xml content
    // to feed to ai to imporve your parseArticleXML algorithm
    saveXmlToRoot(dataAsXML, "test");

    const dataAsJSON = JSON.parse(
        convert.xml2json(dataAsXML, { compact: true })
    );

    const url = `https://pmc.ncbi.nlm.nih.gov/articles/PMC${pmcid}/`;
    const cheerioAPI = await urlToHtml(url);
    //Then pass in the imageID into getImageSRC to get image src
    function _getImageSrc(imageID: string) {
        return getImageSrc(cheerioAPI, imageID);
    }

    const paperSections = parseArticleXml(dataAsXML, _getImageSrc);

    //Convert XML 2 JSON and make it compact names - gives us keys that we can drill into - compact gives us an arr or an obj so thats way we have to check if its arr or an obj in the interface and drill even more if needed to access the ._text
    //This is the raw article that is parsed through the dataAsJSON
    const article: RawArticle = dataAsJSON["pmc-articleset"].article;
    //Made a function that extracts the article details - using the way we got the search results to get the article details that we will still extract in the backend for the paper from raw article
    const articleDetails: FormattedArticle | null =
        extractArticleDetails(article);
    if (!articleDetails) {
        return null;
    }

    return {
        title: articleDetails.title,
        authors: articleDetails.authors,
        pmcid: articleDetails.pmcid,
        paper: paperSections,
    };
};
