import mongoose from "mongoose";

const adminAuditLogSchema = new mongoose.Schema(
    {
        adminEmail: { type: String, required: true, index: true },
        action: { type: String, required: true, index: true },
        target: { type: String, required: true },
        before: { type: mongoose.Schema.Types.Mixed },
        after: { type: mongoose.Schema.Types.Mixed },
    },
    { timestamps: true, versionKey: false },
);

adminAuditLogSchema.index({ createdAt: -1 });

const AdminAuditLog =
    mongoose.models.AdminAuditLog ||
    mongoose.model("AdminAuditLog", adminAuditLogSchema);

export default AdminAuditLog;
