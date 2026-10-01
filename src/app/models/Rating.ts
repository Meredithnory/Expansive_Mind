import mongoose from "mongoose";
import { RATING_SCORES, RATING_SURFACES } from "../lib/rating";

/** An answer to "How is Expansive Mind doing?" (feeds /admin/feedback and /admin/live). */
const ratingSchema = new mongoose.Schema(
    {
        score: { type: String, enum: RATING_SCORES, required: true },
        surface: { type: String, enum: RATING_SURFACES, required: true },
        /** The question asked or the paper, so the score can be read in context. */
        context: { type: String, default: "" },
        comment: { type: String },
        userID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        visitorKey: { type: String, required: true },
    },
    { versionKey: false, timestamps: true },
);

ratingSchema.index({ createdAt: -1 });
ratingSchema.index({ visitorKey: 1, createdAt: -1 });
ratingSchema.index({ userID: 1, createdAt: -1 });

const Rating = mongoose.models.Rating || mongoose.model("Rating", ratingSchema);

export default Rating;
