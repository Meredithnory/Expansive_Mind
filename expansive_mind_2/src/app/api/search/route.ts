import { NextRequest, NextResponse } from "next/server";
import { searchNIHPaperIds, getNIHPaperResults } from "./utils";

export async function GET(req: NextRequest) {
    try {
        //Extracting the params from the front-end with they key 'q'
        const searchValue = req.nextUrl.searchParams.get("q");
        if (!searchValue) {
            throw Error("Invalid search value.");
        }

        const idList = await searchNIHPaperIds(searchValue);
        let paperResults: any;
        if (idList.length === 0) {
            paperResults = [];
        } else {
            paperResults = await getNIHPaperResults(idList);
        }
        console.log(paperResults);
        return NextResponse.json({ results: paperResults });
    } catch (err: any) {
        console.error("message:", err);
        return NextResponse.json(
            { error: err.message || "An internal server error occured" },
            { status: 500 }
        );
    }
}

export async function POST() {}
