import mongoose from "mongoose";
const Schema = mongoose.Schema;

//MongoDB Saved Paper Schema
const savedPaperSchema = new mongoose.Schema(
    {
        pmcid: {
            type: String,
            required: true,
        },
        userID: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

//Created SavedPaperSchema to then be stored under the name "SavedPaperSchema" into db
const SavedPaper =
    mongoose.models.SavedPaper ||
    mongoose.model("SavedPaper", savedPaperSchema);

export default SavedPaper;
