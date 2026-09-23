import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Guest Discovery runs (no account). Stored so product can learn from
 * unsigned questions and briefs. identityHash is a one-way fingerprint of
 * the network identity — never the raw IP.
 */
const guestDiscoverySchema = new Schema(
    {
        identityHash: {
            type: String,
            required: true,
            index: true,
            maxlength: 64,
        },
        question: {
            type: String,
            required: true,
            maxlength: 2_000,
        },
        brief: {
            type: String,
            required: true,
            maxlength: 40_000,
        },
        paperTitles: {
            type: [String],
            default: [],
        },
        papersUsed: {
            type: Number,
            required: true,
            min: 0,
        },
        correctedQuery: {
            type: String,
            maxlength: 2_000,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
    },
    {
        timestamps: true,
        strict: "throw",
    },
);

guestDiscoverySchema.index({ createdAt: -1 });
guestDiscoverySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

if (mongoose.models.GuestDiscovery) {
    mongoose.deleteModel("GuestDiscovery");
}

const GuestDiscovery = mongoose.model("GuestDiscovery", guestDiscoverySchema);

export default GuestDiscovery;
