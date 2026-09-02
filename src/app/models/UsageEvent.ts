import mongoose from "mongoose";

const usageEventSchema = new mongoose.Schema(
    {
        userID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        anonymousId: { type: String },
        feature: { type: String, required: true, index: true },
        provider: { type: String, required: true, index: true },
        operation: { type: String, required: true },
        model: { type: String },
        callCount: { type: Number, required: true, default: 1 },
        inputTokens: { type: Number, default: 0 },
        outputTokens: { type: Number, default: 0 },
        estimatedCostMicros: { type: Number, default: 0 },
        success: { type: Boolean, required: true, default: true },
        metadata: { type: mongoose.Schema.Types.Mixed },
        occurredAt: { type: Date, required: true, default: Date.now },
        expiresAt: { type: Date, required: true },
    },
    { versionKey: false },
);

usageEventSchema.index({ userID: 1, occurredAt: -1 });
usageEventSchema.index({ anonymousId: 1, occurredAt: -1 });
usageEventSchema.index({ occurredAt: -1, feature: 1, provider: 1 });
usageEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const UsageEvent =
    mongoose.models.UsageEvent ||
    mongoose.model("UsageEvent", usageEventSchema);

export default UsageEvent;
