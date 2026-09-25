import mongoose from "mongoose";

const pageEngagementSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true },
        visitorKey: { type: String, required: true },
        userID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        day: { type: String, required: true },
        secondsByPage: { type: mongoose.Schema.Types.Mixed, default: {} },
        moves: { type: mongoose.Schema.Types.Mixed, default: {} },
        expiresAt: { type: Date, required: true },
    },
    { versionKey: false, timestamps: true },
);

pageEngagementSchema.index({ day: 1 });
pageEngagementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PageEngagement =
    mongoose.models.PageEngagement ||
    mongoose.model("PageEngagement", pageEngagementSchema);

export default PageEngagement;
