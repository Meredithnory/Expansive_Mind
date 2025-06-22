import { NextResponse, NextRequest } from "next/server";
import { getPaperDetails } from "./utils";

export async function GET(request: NextRequest) {
    try {
        const pmid = request.nextUrl.searchParams.get("pmid");
        if (!pmid) {
            throw Error("Invalid PMID.");
        }
        const paper = await getPaperDetails(pmid);
        return NextResponse.json({ paper }); // return the paper
    } catch (err: any) {
        console.error("Error in API req handler", err.message);
        return NextResponse.json(
            { error: err.message || "An internal server error occured." },
            { status: 500 }
        );
    }
}
