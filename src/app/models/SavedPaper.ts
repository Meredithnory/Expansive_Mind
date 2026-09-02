import mongoose from "mongoose";
const Schema = mongoose.Schema;

const savedPaperSchema = new mongoose.Schema(
    {
        // Legacy production field — kept during migration, removed after backfill.
        pmcid: {
            type: String,
        },
        primarySource: {
            type: String,
            index: true,
        },
        paperId: {
            type: String,
            index: true,
        },
        idName: {
            type: String,
        },
        userID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

savedPaperSchema.pre("validate", function (next) {
    const hasLegacyShape = Boolean(this.pmcid) && !this.primarySource;
    const hasCurrentShape =
        Boolean(this.primarySource) &&
        Boolean(this.paperId) &&
        Boolean(this.idName);

    if (!hasLegacyShape && !hasCurrentShape) {
        next(
            new Error(
                "SavedPaper must use either legacy pmcid or primarySource, paperId, and idName.",
            ),
        );
        return;
    }

    next();
});

// Only enforce uniqueness once a document has the new shape.
savedPaperSchema.index(
    { userID: 1, primarySource: 1, paperId: 1, idName: 1 },
    {
        unique: true,
        name: "saved_paper_lookup_index",
        partialFilterExpression: {
            primarySource: { $exists: true },
            paperId: { $exists: true },
            idName: { $exists: true },
        },
    }
);
savedPaperSchema.index({ userID: 1, createdAt: -1 });

const SavedPaper =
    mongoose.models.SavedPaper ||
    mongoose.model("SavedPaper", savedPaperSchema);

export default SavedPaper;
