import mongoose from "mongoose";

const Schema = mongoose.Schema;

const highlightCitationSchema = new Schema(
    {
        sectionTitle: { type: String, required: true, maxlength: 200 },
        startLine: { type: Number, required: true, min: 1 },
        endLine: { type: Number, required: true, min: 1 },
        lines: {
            type: [String],
            required: true,
            validate: {
                validator: (lines: string[]) =>
                    Array.isArray(lines) &&
                    lines.length > 0 &&
                    lines.length <= 80,
            },
        },
    },
    { _id: false },
);

const paperHighlightSchema = new Schema(
    {
        userID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        primarySource: {
            type: String,
            required: true,
        },
        paperId: {
            type: String,
            required: true,
        },
        idName: {
            type: String,
            required: true,
        },
        excerpt: {
            type: String,
            required: true,
            maxlength: 4_000,
        },
        citation: {
            type: highlightCitationSchema,
            required: true,
        },
    },
    {
        timestamps: true,
    },
);

paperHighlightSchema.index({
    userID: 1,
    primarySource: 1,
    paperId: 1,
    idName: 1,
    createdAt: 1,
});

const PaperHighlight =
    mongoose.models.PaperHighlight ||
    mongoose.model("PaperHighlight", paperHighlightSchema);

export default PaperHighlight;
