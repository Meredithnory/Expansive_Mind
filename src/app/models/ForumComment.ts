import mongoose from "mongoose";

const { Schema } = mongoose;

const forumCommentSchema = new Schema(
    {
        postID: {
            type: Schema.Types.ObjectId,
            ref: "ForumPost",
            required: true,
        },
        highlightID: { type: Schema.Types.ObjectId, default: null },
        authorID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        body: { type: String, required: true, trim: true, maxlength: 2_000 },
        status: {
            type: String,
            enum: ["visible", "hidden", "removed"],
            default: "visible",
        },
        reportCount: { type: Number, default: 0 },
    },
    { timestamps: true },
);

forumCommentSchema.index({ postID: 1, createdAt: 1 });

const ForumComment =
    mongoose.models.ForumComment ||
    mongoose.model("ForumComment", forumCommentSchema);

export default ForumComment;
