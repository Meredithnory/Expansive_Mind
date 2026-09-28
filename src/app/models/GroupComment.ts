import mongoose from "mongoose";

const { Schema } = mongoose;

const groupCommentSchema = new Schema(
    {
        groupID: {
            type: Schema.Types.ObjectId,
            ref: "Group",
            required: true,
            index: true,
        },
        postID: {
            type: Schema.Types.ObjectId,
            ref: "GroupPost",
            required: true,
        },
        // The shared highlight this replies to; null means the post itself.
        highlightID: { type: Schema.Types.ObjectId, default: null },
        authorID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        body: { type: String, required: true, trim: true, maxlength: 2_000 },
    },
    { timestamps: true },
);

groupCommentSchema.index({ postID: 1, createdAt: 1 });

const GroupComment =
    mongoose.models.GroupComment ||
    mongoose.model("GroupComment", groupCommentSchema);

export default GroupComment;
