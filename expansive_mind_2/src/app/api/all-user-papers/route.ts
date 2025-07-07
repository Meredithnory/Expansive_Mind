import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../authMiddleware";
import SavedPaper from "@/app/models/SavedPaper";
import { getNIHPaperResults } from "../search/utils";

export const GET = withAuth(async (req: NextRequest) => {
    try {
        //first param of .find is an obj of filters - finding all papers associated to just the user
        const allPapers = await SavedPaper.find({
            userID: req.user._id,
        }).sort({
            createdAt: 1,
        });
        const idList = allPapers.map((paperObj) => paperObj.pmcid);
        let paperResults: any;
        if (idList.length === 0) {
            paperResults = [];
        } else {
            paperResults = await getNIHPaperResults(idList);
        }

        const formattedPapers = paperResults.map((paperResult) => ({
            id: paperResult.pmcid,
            title: paperResult.title,
            authors: paperResult.authors.join(", "),
            description: paperResult.abstract,
        }));

        return NextResponse.json({ papers: formattedPapers });
    } catch (err: any) {
        console.error("message:", err);
        return NextResponse.json(
            { error: err.message || "An internal server error occured" },
            { status: 500 }
        );
    }
});
