import { NextResponse } from "next/server";
import { withAdmin } from "../../../lib/admin";
import AdminAuditLog from "../../../models/AdminAuditLog";

export const GET = withAdmin(async () => {
    const entries = await AdminAuditLog.find()
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    return NextResponse.json(
        { entries },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
