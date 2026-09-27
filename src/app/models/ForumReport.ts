import mongoose from "mongoose";

const { Schema } = mongoose;

const forumReportSchema = new Schema(
    {
        targetType: { type: String, enum: ["post", "comment"], required: true },
        targetID: { type: Schema.Types.ObjectId, required: true },
        reporterID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        reason: {
            type: String,
            enum: ["spam", "harassment", "misinformation", "copyright", "other"],
            required: true,
        },
        details: { type: String, maxlength: 500, default: "" },
        resolved: { type: Boolean, default: false },
    },
    { timestamps: true },
);

// One report per person per item.
forumReportSchema.index(
    { targetType: 1, targetID: 1, reporterID: 1 },
    { unique: true },
);
forumReportSchema.index({ resolved: 1, createdAt: -1 });

const ForumReport =
    mongoose.models.ForumReport ||
    mongoose.model("ForumReport", forumReportSchema);

export default ForumReport;
