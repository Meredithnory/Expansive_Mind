//Base URL and NIH KEY
const NIH_API_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const NIH_API_KEY = process.env.API_KEY;

//Function to get paper details from PMID passed into the function
export const getPaperDetails = async (pmid: string) => {
    if (!NIH_API_KEY) {
        throw Error("Invalid API Key");
    }
    const params = new URLSearchParams();
    params.append("id", pmid);
    params.append("api_key", NIH_API_KEY);
    params.append("db", "pubmed");
    params.append("retmode", "xml");
    params.append("rettype", "full");
    const res = await fetch(`${NIH_API_URL}?${params}`);
    // console.log(res);
    const data = await res.text();
    console.log(data);

    return data;
};
