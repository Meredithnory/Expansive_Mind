import mongoose from "mongoose";

const { Schema } = mongoose;

// A blocker no longer sees the blocked person's forum posts or comments.
const blockSchema = new Schema(
    {
        blockerID: { type: Schema.Types.ObjectId, ref: "User", required: true },
        blockedID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
    },
    { timestamps: true },
);

blockSchema.index({ blockerID: 1, blockedID: 1 }, { unique: true });

const Block = mongoose.models.Block || mongoose.model("Block", blockSchema);

export default Block;
