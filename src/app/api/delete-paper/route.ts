// app/api/delete-paper
import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "../authMiddleware";
import SavedPaper from "../../models/SavedPaper";
import Message from "../../models/Message";
import { findSavedPaperForUser } from "../../lib/saved-paper-utils";
import { hasValidMutationOrigin } from "../../lib/request-security";
import { normalizeStoredPaperId } from "../../lib/paper-sources";
import PaperHighlight from "../../models/PaperHighlight";

export const DELETE = withAuth(async (request: NextRequest) => {
    try {
        if (!hasValidMutationOrigin(request)) {
            return NextResponse.json(
                { success: false, error: "Invalid origin." },
                { status: 403 },
            );
        }
        const { primarySource, paperId, idName } = await request.json();
        const userID = request.user._id;

        if (!primarySource || !paperId || !idName) {
            return NextResponse.json(
                {
                    success: false,
                    error: "primarySource, paperId, and idName are required",
                },
                { status: 400 }
            );
        }

        const paper = await findSavedPaperForUser({
            userID,
            primarySource,
            paperId,
            idName,
        });

        if (!paper) {
            return NextResponse.json(
                { success: false, error: "Paper not found or not authorized." },
                { status: 404 }
            );
        }

        await Message.deleteMany({ savedPaperID: paper._id });
        await PaperHighlight.deleteMany({
            userID,
            primarySource: paper.primarySource || primarySource,
            paperId: paper.paperId || normalizeStoredPaperId(paperId),
            idName: paper.idName || idName,
        });
        await SavedPaper.deleteOne({ _id: paper._id });

        return NextResponse.json(
            { success: true },
            {
                status: 200,
                headers: { "Cache-Control": "private, no-store" },
            },
        );
    } catch (error) {
        console.error("Error deleting paper:", error);
        return NextResponse.json(
            { success: false, error: "Failed to delete paper" },
            { status: 500 }
        );
    }
});
