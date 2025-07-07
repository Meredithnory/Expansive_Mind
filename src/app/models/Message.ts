import mongoose from "mongoose";
const Schema = mongoose.Schema;

//MongoDB Message Schema
const messageSchema = new mongoose.Schema(
    {
        savedPaperID: {
            type: Schema.Types.ObjectId,
            ref: "SavedPaper",
            required: true,
        },
        sender: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const Message =
    mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;
