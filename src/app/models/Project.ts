import mongoose from "mongoose";

const { Schema } = mongoose;

const projectPaperSchema = new Schema(
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
    },
    {
        _id: false,
        strict: "throw",
    },
);

const projectGapSchema = new Schema(
    {
        title: { type: String, required: true, maxlength: 300 },
        description: { type: String, required: true, maxlength: 4_000 },
        whyItMatters: { type: String, maxlength: 2_000 },
        citations: { type: [Number], default: [] },
        confidence: {
            type: String,
            enum: ["established", "suggested", "speculative"],
        },
    },
    {
        _id: false,
        strict: "throw",
    },
);

const briefingTriedSchema = new Schema(
    {
        paperIndex: { type: Number, required: true, min: 1 },
        method: { type: String, default: "" },
        finding: { type: String, default: "" },
    },
    {
        _id: false,
        strict: "throw",
    },
);

const nextMoveSchema = new Schema(
    {
        title: { type: String, default: "" },
        model: { type: String, default: "" },
        comparison: { type: String, default: "" },
        readout: { type: String, default: "" },
        paperRefs: { type: [Number], default: [] },
    },
    {
        _id: false,
        strict: "throw",
    },
);

const briefingSchema = new Schema(
    {
        alreadyTried: { type: [briefingTriedSchema], default: [] },
        stillOpen: { type: [String], default: [] },
        nextMove: { type: nextMoveSchema },
        couldNotVerify: { type: [String], default: [] },
    },
    {
        _id: false,
        strict: "throw",
    },
);

const projectStepSchema = new Schema(
    {
        title: { type: String, required: true, maxlength: 300 },
        description: { type: String, default: "" },
        status: {
            type: String,
            enum: ["pending", "in-progress", "done"],
            default: "pending",
        },
        paperRefs: { type: [Number], default: [] },
    },
    {
        _id: false,
        strict: "throw",
    },
);

const projectSchema = new Schema(
    {
        userID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            maxlength: 300,
        },
        sourceDiscoveryID: {
            type: Schema.Types.ObjectId,
            ref: "SavedDiscovery",
        },
        gap: {
            type: projectGapSchema,
            required: true,
        },
        papers: {
            type: [projectPaperSchema],
            default: [],
        },
        plan: {
            type: [projectStepSchema],
            required: true,
        },
        briefing: {
            type: briefingSchema,
        },
        notes: {
            type: String,
            default: "",
            maxlength: 20_000,
        },
    },
    {
        timestamps: true,
        strict: "throw",
    },
);

projectSchema.index({ userID: 1, createdAt: -1 });

if (mongoose.models.Project) {
    mongoose.deleteModel("Project");
}

const Project = mongoose.model("Project", projectSchema);

export default Project;
