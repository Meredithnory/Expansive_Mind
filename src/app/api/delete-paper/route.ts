// app/api/delete-paper
import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "../authMiddleware";
import SavedPaper from "../../models/SavedPaper";
import Message from "../../models/Message";

export const DELETE = withAuth(async (request: NextRequest) => {
    try {
        const { id } = await request.json(); //PMCID
        const userID = request.user._id; // from authMiddleware
        if (!id) {
            return NextResponse.json(
                { success: false, error: "Paper id is required" },
                { status: 400 }
            );
        }
        //Find the paper and ensure it belongs to the user
        const paper = await SavedPaper.findOne({ pmcid: id, userID });
        if (!paper) {
            return NextResponse.json(
                { success: false, error: "Paper not found or not authorized." },
                { status: 404 }
            );
        }
        //Delete all messages linked to this paper
        const deletions = await Message.deleteMany({ savedPaperID: paper._id });

        //Delete the paper itself
        await SavedPaper.deleteOne({ _id: paper._id });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Error deleting paper:", error);
        return NextResponse.json(
            { success: false, error: "Failed to delete paper" },
            { status: 500 }
        );
    }
});
