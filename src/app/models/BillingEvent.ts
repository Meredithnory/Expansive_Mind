import mongoose from "mongoose";

const billingEventSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true },
        type: { type: String, required: true },
        processedAt: { type: Date, required: true, default: Date.now },
    },
    { versionKey: false },
);

const BillingEvent =
    mongoose.models.BillingEvent ||
    mongoose.model("BillingEvent", billingEventSchema);

export default BillingEvent;
