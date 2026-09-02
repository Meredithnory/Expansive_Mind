import mongoose from "mongoose";

const usageCounterSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true },
        count: { type: Number, required: true, default: 0 },
        userID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        identityHash: { type: String, required: true },
        feature: { type: String, required: true },
        period: { type: String, required: true },
        expiresAt: { type: Date, required: true },
    },
    { versionKey: false, timestamps: true },
);

usageCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
usageCounterSchema.index({ userID: 1, period: 1 });
usageCounterSchema.index({ identityHash: 1, feature: 1, period: 1 });

const UsageCounter =
    mongoose.models.UsageCounter ||
    mongoose.model("UsageCounter", usageCounterSchema);

export default UsageCounter;
