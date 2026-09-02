import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth } from "../../authMiddleware";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import SavedDiscovery from "../../../models/SavedDiscovery";
import { generateShareSlug } from "../../../lib/share-slug";

// Creates (or returns) the public share slug for a saved discovery brief.
export const POST = withAuth(async (request: NextRequest) => {
    try {
        if (!hasValidMutationOrigin(request)) {
            return NextResponse.json(
                { error: "Invalid origin." },
                { status: 403 },
            );
        }

        const data = await request.json();
        const id = typeof data.id === "string" ? data.id : "";
        if (!mongoose.isValidObjectId(id)) {
            return NextResponse.json(
                { error: "A valid discovery ID is required." },
                { status: 400 },
            );
        }

        const discovery = await SavedDiscovery.findOne({
            _id: id,
            userID: request.user._id,
        });
        if (!discovery) {
            return NextResponse.json(
                { error: "Discovery not found." },
                { status: 404 },
            );
        }

        if (!discovery.shareSlug) {
            discovery.shareSlug = generateShareSlug();
            await discovery.save();
        }

        return NextResponse.json(
            { slug: discovery.shareSlug },
            { headers: { "Cache-Control": "private, no-store" } },
        );
    } catch (error) {
        console.error("Discovery share failed", error);
        return NextResponse.json(
            { error: "Unable to create a share link." },
            { status: 500 },
        );
    }
});
