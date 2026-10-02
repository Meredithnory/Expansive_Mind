import mongoose from "mongoose";

/**
 * One person used up one monthly allowance (Discovery, searches, AI
 * questions). One row per person, feature, and month: the first one emails
 * Meredith, and /admin lists them.
 */
const limitAlertSchema = new mongoose.Schema(
    {
        /** `${userID}:${feature}:${period}` */
        _id: { type: String, required: true },
        userID: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        feature: { type: String, required: true },
        period: { type: String, required: true },
        limit: { type: Number, required: true },
        used: { type: Number, required: true },
        /** They tried again after running out. */
        blocked: { type: Boolean, default: false },
        emailed: { type: Boolean, default: false },
        /** They asked for more from the limit pop-up. */
        requestedAt: { type: Date },
        requestNote: { type: String, maxlength: 600 },
        firstAt: { type: Date, required: true },
        lastAt: { type: Date, required: true },
        expiresAt: { type: Date, required: true },
    },
    { versionKey: false },
);

limitAlertSchema.index({ period: 1, firstAt: -1 });
limitAlertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const LimitAlert =
    mongoose.models.LimitAlert || mongoose.model("LimitAlert", limitAlertSchema);

export default LimitAlert;
