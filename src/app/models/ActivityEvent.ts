import mongoose from "mongoose";

/** One step someone took (a page view, a discovery, a search), for /admin/live. */
const activityEventSchema = new mongoose.Schema(
    {
        visitorKey: { type: String, required: true },
        userID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        kind: { type: String, required: true },
        page: { type: String },
        path: { type: String },
        detail: { type: String },
        at: { type: Date, required: true, default: Date.now },
        expiresAt: { type: Date, required: true },
    },
    { versionKey: false },
);

activityEventSchema.index({ at: -1 });
activityEventSchema.index({ visitorKey: 1, at: -1 });
activityEventSchema.index({ userID: 1, at: -1 });
activityEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ActivityEvent =
    mongoose.models.ActivityEvent ||
    mongoose.model("ActivityEvent", activityEventSchema);

export default ActivityEvent;
