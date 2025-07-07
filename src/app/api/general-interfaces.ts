export interface AbstractParagraph {
    _text: string;
}
export interface AbstractSection {
    title: { _text: string };
    p: AbstractParagraph | AbstractParagraph[];
}
export interface ArticleID {
    _attributes: {
        "pub-id-type": string;
    };
    _text: string;
}
export interface Contributor {
    _attributes: {
        "contrib-type": string;
    };
    name: {
        surname: { _text: string };
        "given-names": { _text: string };
    };
}
export interface PubDate {
    _attributes: {
        "pub-type": string;
    };
    day: { _text: string };
    month: { _text: string };
    year: { _text: string };
}

//Interface for taking in raw article from NIH PMC API
export interface RawArticle {
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
                | {
                      p: AbstractParagraph[] | AbstractParagraph;
                  }
                | AbstractSection[]
                | AbstractSection;
        };
    };
    body: {};
    back: {};
}

//Interface for formatted article from raw article PMC API
export interface FormattedArticle {
    pmcid: string;
    title: string;
    authors: string[];
    abstract: string;
    date: string;
}

//Interface for full paper extraction
export interface SubSection {
    title: string;
    content: string;
    graphicSrc?: string;
    graphicTitle?: string;
    graphicContent?: string;
}

export interface Section {
    title: string;
    content: string;
    subSections: SubSection[];
    graphicSrc?: string;
    graphicTitle?: string;
    graphicContent?: string;
}
export interface FormattedPaper {
    title: string;
    authors: string[];
    pmcid: string;
    paper: Section[];
}
