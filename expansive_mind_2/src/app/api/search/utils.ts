import convert from "xml-js";
//Base URL and NIH KEY
const NIH_API_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const NIH_API_KEY = process.env.API_KEY;

//Pass in a search Value or keywords to this function to handle the search of the paper IDs that match that keyword/search value
export const searchNIHPaperIds = async (searchValue: string) => {
    if (!NIH_API_KEY) {
        throw Error("Invalid API Key");
    }
    //Appending paraments to the params, these params are given from the documentation of PubMed
    const params = new URLSearchParams();
    params.append("db", "pubmed");
    params.append("api_key", NIH_API_KEY);
    params.append("term", searchValue);
    // params.append("filter", encodeURIComponent("free full text[filter]"));
    params.append("retmode", "json");
    params.append("retmax", "100");
    params.append("field", "title");

    //We are using the esearch to search for data in the db of Pubmed
    const res = await fetch(`${NIH_API_URL}/esearch.fcgi?${params}`);
    const data = await res.json();
    console.log(data);

    //From the data recieved we want an ID list of the papers that match the query
    const idList = data.esearchresult.idlist;

    return idList;
};
//Now we will pass the the idList into this function to extract the data that contains the papers
export const getNIHPaperResults = async (idList: string[]) => {
    if (!NIH_API_KEY) {
        throw Error("Invalid API Key");
    }
    const params = new URLSearchParams();
    params.append("db", "pubmed");
    params.append("id", idList.join(","));

    const res = await fetch(`${NIH_API_URL}/efetch.fcgi?${params}`);
    const data = await res.text();

    //Converting the data as JSON, gave options and chose XML format
    // so that it could be easier to convert it to JSON by using a package and making it compact so that we don't need to drill elements each time
    const dataAsJSON = JSON.parse(convert.xml2json(data, { compact: true }));
    const articles = dataAsJSON.PubmedArticleSet.PubmedArticle;

    interface FormattedArticle {
        pmid: string;
        title: string;
        authors: string[];
        abstract: string;
        date: string;
    }
    const formattedArticles: FormattedArticle[] = [];

    for (let article of articles) {
        const publicationType =
            article.MedlineCitation.Article.PublicationTypeList.PublicationType
                ._text;

        if (
            publicationType !== "Journal Article" ||
            !article.MedlineCitation.Article.Abstract
        ) {
            {
                continue;
            }
        }

        ///////////////Find ID /////////////////////////
        let pmid = article.MedlineCitation.PMID._text;
        //////////////Find the title//////////////////
        let title = article.MedlineCitation.Article.ArticleTitle._text;
        if (Array.isArray(title)) {
            title = title.join("");
        }

        ////////////Find the abstract////////////////
        let abstract = article.MedlineCitation.Article.Abstract.AbstractText;
        if (Array.isArray(abstract)) {
            abstract = abstract[0]._text;
        } else {
            abstract = abstract._text;
        }
        ///////////Find the authors////////////////////
        interface Author {
            LastName: { _text: string };
            Initials: { _text: string };
        }

        let authorOrAuthors: Author | Author[] =
            article.MedlineCitation.Article.AuthorList.Author;
        let formattedAuthors: string[] = [];
        if (Array.isArray(authorOrAuthors)) {
            for (let author of authorOrAuthors) {
                if (!author.LastName || !author.Initials) {
                    continue;
                }
                formattedAuthors.push(
                    author.LastName._text + " " + author.Initials._text
                );
            }
        } else if (authorOrAuthors.LastName && authorOrAuthors.Initials) {
            formattedAuthors.push(
                authorOrAuthors.LastName._text +
                    " " +
                    authorOrAuthors.Initials._text
            );
        }
        /////////////Find the date//////////////////
        interface PubDate {
            Year: { _text: string };
            Month: { _text: string };
            Day: { _text: string };
        }

        let date: PubDate =
            article.MedlineCitation.Article.Journal.JournalIssue.PubDate;

        let formattedDate = date.Year._text;
        if (date.Month) {
            formattedDate += " " + date.Month._text;
            if (date.Day) {
                formattedDate += " " + date.Day._text;
            }
        }

        formattedArticles.push({
            pmid,
            title,
            authors: formattedAuthors,
            abstract,
            date: formattedDate,
        });
    }

    return formattedArticles;
};
