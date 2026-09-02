import mongoose from "mongoose";

const providerCacheSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true },
        namespace: { type: String, required: true, index: true },
        value: { type: mongoose.Schema.Types.Mixed, required: true },
        expiresAt: { type: Date, required: true },
    },
    { versionKey: false, timestamps: true },
);

providerCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ProviderCache =
    mongoose.models.ProviderCache ||
    mongoose.model("ProviderCache", providerCacheSchema);

export default ProviderCache;
