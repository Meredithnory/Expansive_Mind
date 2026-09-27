import mongoose from "mongoose";

const { Schema } = mongoose;

// A highlight as shared into a group. `excerpt` is stored only when the
// paper passes the strict quote gate; otherwise readers get the section and
// line range and open the paper to read it.
const sharedGroupHighlightSchema = new Schema(
    {
        excerpt: { type: String, maxlength: 4_000, default: null },
        sectionTitle: { type: String, required: true, maxlength: 200 },
        startLine: { type: Number, required: true, min: 1 },
        endLine: { type: Number, required: true, min: 1 },
        color: { type: String, enum: ["pink", "blue", "yellow"], default: "pink" },
    },
    { _id: true },
);

const groupPostSchema = new Schema(
    {
        groupID: {
            type: Schema.Types.ObjectId,
            ref: "Group",
            required: true,
        },
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
        note: { type: String, maxlength: 1_000, default: "" },
        quotable: { type: Boolean, default: false },
        highlights: {
            type: [sharedGroupHighlightSchema],
            default: [],
            validate: (value: unknown[]) => value.length <= 20,
        },
    },
    { timestamps: true },
);

groupPostSchema.index({ groupID: 1, createdAt: -1 });

const GroupPost =
    mongoose.models.GroupPost || mongoose.model("GroupPost", groupPostSchema);

export default GroupPost;
