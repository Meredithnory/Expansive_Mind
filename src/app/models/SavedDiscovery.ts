import mongoose from "mongoose";

const { Schema } = mongoose;

const discoverPaperSchema = new Schema(
    {
        index: { type: Number, required: true, min: 1 },
        database: {
            type: String,
            required: true,
            enum: ["nih", "springer", "scholar"],
        },
        paperId: { type: String, required: true },
        idName: { type: String, required: true },
        title: { type: String, required: true },
        authors: { type: [String], default: [] },
        date: { type: String, default: "" },
        sourceLabel: { type: String, required: true },
        sourceUrl: { type: String, default: "" },
        href: { type: String, required: true },
        doi: { type: String },
        indexedBy: { type: [String], default: undefined },
    },
    {
        _id: false,
        strict: "throw",
    },
);

const paperExtractionSchema = new Schema(
    {
        index: { type: Number, required: true, min: 1 },
        title: { type: String, required: true },
        sourceLabel: { type: String, required: true },
        authors: { type: [String], default: [] },
        publicationDate: { type: String },
        keyFindings: { type: [String], default: [] },
        methods: { type: String, default: "" },
        limitations: { type: [String], default: [] },
        openQuestions: { type: [String], default: [] },
        evidenceType: {
            type: String,
            enum: [
                "review",
                "rct",
                "observational",
                "in-vitro",
                "animal",
                "computational",
                "other",
            ],
            default: "other",
        },
        supportingExcerpt: { type: String, maxlength: 800 },
        population: { type: String, maxlength: 400 },
        disease: { type: String, maxlength: 400 },
        outcome: { type: String, maxlength: 400 },
        timeHorizon: { type: String, maxlength: 200 },
        studyDesign: {
            type: String,
            enum: [
                "evidence-synthesis",
                "rct",
                "observational",
                "preclinical-experimental",
                "animal",
                "computational",
                "other",
            ],
        },
        includedStudyDesign: { type: String, maxlength: 80 },
        populationMatch: {
            type: String,
            enum: ["direct", "indirect", "unknown"],
        },
        claims: {
            type: [
                new Schema(
                    {
                        claimId: { type: String, required: true, maxlength: 220 },
                        claimText: { type: String, required: true, maxlength: 600 },
                        claimKind: {
                            type: String,
                            required: true,
                            enum: ["finding", "synthesis", "hypothesis"],
                        },
                        paperId: { type: String, required: true, maxlength: 200 },
                        sourceAccess: {
                            type: String,
                            required: true,
                            enum: ["full_text", "excerpt", "abstract", "metadata"],
                        },
                        passageLocator: { type: String, maxlength: 240 },
                        passageText: { type: String, maxlength: 800 },
                        supportRelation: {
                            type: String,
                            required: true,
                            enum: [
                                "supports",
                                "partial",
                                "contradicts",
                                "indirect",
                                "unverified",
                            ],
                        },
                        populationMatch: {
                            type: String,
                            required: true,
                            enum: ["direct", "indirect", "unknown"],
                        },
                        verificationStatus: {
                            type: String,
                            required: true,
                            enum: [
                                "not_checked",
                                "machine_checked",
                                "reviewer_checked",
                            ],
                        },
                    },
                    { _id: false, strict: "throw" },
                ),
            ],
            default: undefined,
        },
    },
    {
        _id: false,
        strict: "throw",
    },
);

const savedDiscoverySchema = new Schema(
    {
        userID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        question: {
            type: String,
            required: true,
            maxlength: 2_000,
        },
        brief: {
            type: String,
            required: true,
        },
        papers: {
            type: [discoverPaperSchema],
            required: true,
        },
        // Public share slug; set only after the owner shares the brief.
        shareSlug: {
            type: String,
            index: { unique: true, sparse: true },
        },
        report: {
            type: Schema.Types.Mixed,
        },
        extractions: {
            type: [paperExtractionSchema],
        },
        meta: {
            springerCandidateCount: { type: Number, required: true, min: 0 },
            springerEligibleCount: { type: Number, required: true, min: 0 },
            nihFillCount: { type: Number, required: true, min: 0 },
            papersUsed: { type: Number, required: true, min: 0 },
            usedNihFill: { type: Boolean, required: true },
            usedScholar: { type: Boolean },
            nihCandidateCount: { type: Number, min: 0 },
            nihEligibleCount: { type: Number, min: 0 },
            scholarCandidateCount: { type: Number, min: 0 },
            scholarEligibleCount: { type: Number, min: 0 },
            correctedQuery: { type: String },
            subQueriesUsed: { type: [String] },
            extractionFailureCount: { type: Number, min: 0 },
            additionalIndexes: { type: [new Schema({
                name: String,
                status: { type: String, enum: ["ok", "partial", "unavailable"] },
                metadataCount: Number,
                candidateCount: Number,
                eligibleCount: Number,
                note: String,
            }, { _id: false, strict: "throw" })], default: undefined },
        },
    },
    {
        timestamps: true,
        strict: "throw",
    },
);

savedDiscoverySchema.index({ userID: 1, createdAt: -1 });

if (mongoose.models.SavedDiscovery) {
    mongoose.deleteModel("SavedDiscovery");
}

const SavedDiscovery = mongoose.model("SavedDiscovery", savedDiscoverySchema);

export default SavedDiscovery;
