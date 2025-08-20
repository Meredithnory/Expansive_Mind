import { NextRequest, NextResponse } from "next/server";
import { searchNIHPaperIds, getNIHPaperResults } from "./utils";
import { withAuth } from "../authMiddleware";

export const GET = withAuth(async (req: NextRequest) => {
    try {
        //Extracting the params from the front-end with they key 'q'
        const searchValue = req.nextUrl.searchParams.get("q");
        //Retrieve page from front-end
        const page = parseInt(req.nextUrl.searchParams.get("page") || "0", 10);

        if (!searchValue) {
            throw Error("Invalid search value.");
        }

        const { ids, totalCount, totalPages } = await searchNIHPaperIds(
            searchValue,
            page
        );
        let paperResults: any;
        if (ids.length === 0) {
            paperResults = [];
        } else {
            paperResults = await getNIHPaperResults(ids);
        }

        return NextResponse.json({
            results: paperResults,
            totalCount,
            totalPages,
            page,
        });
    } catch (err: any) {
        console.error("message:", err);
        return NextResponse.json(
            { error: err.message || "An internal server error occured" },
            { status: 500 }
        );
    }
});
