import mongoose from "mongoose";

const { Schema } = mongoose;

const followSchema = new Schema(
    {
        followerID: { type: Schema.Types.ObjectId, ref: "User", required: true },
        followeeID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
    },
    { timestamps: true },
);

followSchema.index({ followerID: 1, followeeID: 1 }, { unique: true });

const Follow = mongoose.models.Follow || mongoose.model("Follow", followSchema);

export default Follow;
