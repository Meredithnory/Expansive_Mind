import mongoose from "mongoose";

const { Schema } = mongoose;

const groupSchema = new Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 60 },
        ownerID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        // Secret part of the invite link. Only the owner is shown it, and they
        // can replace it to stop an old link from working.
        inviteCode: { type: String, required: true, unique: true },
    },
    { timestamps: true },
);

const Group = mongoose.models.Group || mongoose.model("Group", groupSchema);

export default Group;
