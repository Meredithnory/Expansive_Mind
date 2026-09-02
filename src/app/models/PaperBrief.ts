import mongoose from "mongoose";

const { Schema } = mongoose;

const paperBriefSchema = new Schema(
    {
        userID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        database: {
            type: String,
            required: true,
            enum: ["nih", "springer", "scholar"],
        },
        paperId: { type: String, required: true },
        idName: { type: String, required: true },
        title: { type: String, required: true },
        authors: { type: [String], default: [] },
        sourceLabel: { type: String, default: "" },
        canonicalUrl: { type: String, default: "" },
        publicationDate: { type: String, default: "" },
        brief: { type: String, required: true },
        slug: { type: String, required: true, unique: true },
    },
    {
        timestamps: true,
        strict: "throw",
    },
);

// One brief per user per paper; regenerating overwrites it.
paperBriefSchema.index(
    { userID: 1, database: 1, paperId: 1 },
    { unique: true },
);

const PaperBrief =
    mongoose.models.PaperBrief ||
    mongoose.model("PaperBrief", paperBriefSchema);

export default PaperBrief;
