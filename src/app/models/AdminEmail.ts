import mongoose from "mongoose";

/** An email an admin sent from /admin/email: what, to whom, and how it went. */
const adminEmailSchema = new mongoose.Schema(
    {
        subject: { type: String, required: true, maxlength: 200 },
        body: { type: String, required: true, maxlength: 10_000 },
        audience: {
            type: String,
            required: true,
            enum: ["one", "pro", "free", "new"],
        },
        /** For "one": the person it went to. */
        userID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        onlyOptedIn: { type: Boolean, required: true },
        test: { type: Boolean, default: false },
        recipients: { type: Number, required: true, min: 0 },
        sent: { type: Number, required: true, min: 0 },
        failed: { type: Number, required: true, min: 0 },
        sentBy: { type: String, required: true },
    },
    { timestamps: true, versionKey: false },
);

adminEmailSchema.index({ createdAt: -1 });

const AdminEmail =
    mongoose.models.AdminEmail || mongoose.model("AdminEmail", adminEmailSchema);

export default AdminEmail;
