import "server-only";
import connectDB from "../db/connectDB";
import AdminAuditLog from "../models/AdminAuditLog";

export async function recordAdminAction(input: {
    adminEmail: string;
    action: string;
    target: string;
    before?: unknown;
    after?: unknown;
}) {
    await connectDB();
    await AdminAuditLog.create({
        ...input,
        adminEmail: input.adminEmail.trim().toLowerCase(),
    });
}
