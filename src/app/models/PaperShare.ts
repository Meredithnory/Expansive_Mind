import mongoose from "mongoose";

const { Schema } = mongoose;

const sharedCitationSchema = new Schema(
    {
        sectionTitle: { type: String, required: true, maxlength: 200 },
        startLine: { type: Number, required: true, min: 1 },
        endLine: { type: Number, required: true, min: 1 },
        lines: { type: [String], required: true },
    },
    { _id: false },
);

const sharedHighlightSchema = new Schema(
    {
        excerpt: { type: String, required: true, maxlength: 4_000 },
        citation: { type: sharedCitationSchema, required: true },
        createdAt: { type: Date },
    },
    { _id: false },
);

const paperShareSchema = new Schema(
    {
        ownerID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        ownerName: { type: String, required: true, maxlength: 120 },
        slug: { type: String, required: true, unique: true, index: true },
        database: {
            type: String,
            required: true,
            enum: ["nih", "springer", "scholar"],
        },
        paperId: { type: String, required: true },
        idName: { type: String, required: true },
        title: { type: String, required: true, maxlength: 1_000 },
        authors: { type: [String], default: [] },
        sourceLabel: { type: String, default: "" },
        canonicalUrl: { type: String, default: "" },
        publicationDate: { type: String, default: "" },
        highlights: {
            type: [sharedHighlightSchema],
            default: [],
            validate: {
                validator: (items: unknown[]) => items.length <= 50,
                message: "A paper share can contain up to 50 highlights.",
            },
        },
    },
    { timestamps: true, strict: "throw" },
);

// Re-sharing refreshes one stable link rather than creating link clutter.
paperShareSchema.index(
    { ownerID: 1, database: 1, paperId: 1, idName: 1 },
    { unique: true },
);

const PaperShare =
    mongoose.models.PaperShare ||
    mongoose.model("PaperShare", paperShareSchema);

export default PaperShare;
