import mongoose from "mongoose";

const { Schema } = mongoose;

// Same shape as a group post highlight: text only when the paper's license
// allows quoting, otherwise section + line range.
const forumHighlightSchema = new Schema(
    {
        excerpt: { type: String, maxlength: 4_000, default: null },
        sectionTitle: { type: String, required: true, maxlength: 200 },
        startLine: { type: Number, required: true, min: 1 },
        endLine: { type: Number, required: true, min: 1 },
        color: { type: String, enum: ["pink", "blue", "yellow"], default: "pink" },
    },
    { _id: true },
);

const forumPostSchema = new Schema(
    {
        authorID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        database: { type: String, enum: ["nih", "springer", "scholar"], required: true },
        paperId: { type: String, required: true, maxlength: 300 },
        idName: { type: String, required: true, maxlength: 40 },
        paperTitle: { type: String, required: true, maxlength: 500 },
        body: { type: String, maxlength: 2_000, default: "" },
        tags: {
            type: [String],
            default: [],
            validate: (value: string[]) => value.length <= 3,
        },
        quotable: { type: Boolean, default: false },
        highlights: {
            type: [forumHighlightSchema],
            default: [],
            validate: (value: unknown[]) => value.length <= 10,
        },
        // visible -> hidden (auto after reports, or by an admin) -> removed.
        status: {
            type: String,
            enum: ["visible", "hidden", "removed"],
            default: "visible",
        },
        reportCount: { type: Number, default: 0 },
        commentCount: { type: Number, default: 0 },
    },
    { timestamps: true },
);

forumPostSchema.index({ status: 1, createdAt: -1 });
forumPostSchema.index({ status: 1, tags: 1, createdAt: -1 });
forumPostSchema.index({ authorID: 1, status: 1, createdAt: -1 });

const ForumPost =
    mongoose.models.ForumPost || mongoose.model("ForumPost", forumPostSchema);

export default ForumPost;
