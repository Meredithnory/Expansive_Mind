import { NextResponse, NextRequest } from "next/server";
import { getPaperDetails } from "./utils";

export async function GET(request: NextRequest) {
    try {
        const pmcid = request.nextUrl.searchParams.get("pmcid");
        if (!pmcid) {
            throw Error("Invalid PMCID.");
        }
        const paper = await getPaperDetails(pmcid);
        return NextResponse.json({ paper }); // return the paper as the key paper
    } catch (err: any) {
        console.error("Error in API req handler", err.message);
        return NextResponse.json(
            { error: err.message || "An internal server error occured." },
            { status: 500 }
        );
    }
}
