import mongoose from "mongoose";

const { Schema } = mongoose;

const groupMemberSchema = new Schema(
    {
        groupID: {
            type: Schema.Types.ObjectId,
            ref: "Group",
            required: true,
        },
        userID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        role: { type: String, enum: ["owner", "member"], default: "member" },
    },
    { timestamps: true },
);

groupMemberSchema.index({ groupID: 1, userID: 1 }, { unique: true });

const GroupMember =
    mongoose.models.GroupMember ||
    mongoose.model("GroupMember", groupMemberSchema);

export default GroupMember;
