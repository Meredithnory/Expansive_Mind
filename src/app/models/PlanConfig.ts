import mongoose from "mongoose";

const quotaSchema = new mongoose.Schema(
    {
        search: { type: Number, required: true, min: 0 },
        discover: { type: Number, required: true, min: 0 },
        chat: { type: Number, required: true, min: 0 },
        scholar_search: { type: Number, required: true, min: 0 },
        projects: { type: Number, required: true, min: 0, default: 0 },
    },
    { _id: false },
);

const priceSchema = new mongoose.Schema(
    {
        amount: { type: Number, required: true, min: 50 },
        currency: { type: String, required: true, default: "usd" },
        stripePriceId: { type: String, default: "", trim: true },
    },
    { _id: false },
);

const planConfigSchema = new mongoose.Schema(
    {
        _id: { type: String, default: "primary" },
        prices: {
            month: { type: priceSchema, required: true },
            year: { type: priceSchema, required: true },
        },
        entitlements: {
            guest: { type: quotaSchema, required: true },
            free: { type: quotaSchema, required: true },
            pro: { type: quotaSchema, required: true },
        },
        updatedBy: { type: String },
    },
    { timestamps: true, versionKey: false },
);

if (mongoose.models.PlanConfig) {
    mongoose.deleteModel("PlanConfig");
}

const PlanConfig = mongoose.model("PlanConfig", planConfigSchema);

export default PlanConfig;
