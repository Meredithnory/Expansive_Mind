import mongoose from "mongoose";

const rateLimitSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true },
        count: { type: Number, required: true, default: 0 },
        expiresAt: { type: Date, required: true },
    },
    { versionKey: false },
);

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit =
    mongoose.models.RateLimit ||
    mongoose.model("RateLimit", rateLimitSchema);

export default RateLimit;
