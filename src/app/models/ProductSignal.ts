import mongoose from "mongoose";

/** Daily counts of product moments the admin pulse reads (no people, no text). */
const productSignalSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true },
        day: { type: String, required: true, index: true },
        key: { type: String, required: true },
        count: { type: Number, default: 0, min: 0 },
        expiresAt: { type: Date, required: true },
    },
    { versionKey: false },
);

productSignalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ProductSignal =
    mongoose.models.ProductSignal ||
    mongoose.model("ProductSignal", productSignalSchema);

export default ProductSignal;
