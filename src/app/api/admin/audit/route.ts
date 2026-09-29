import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "../../../lib/admin";
import AdminAuditLog from "../../../models/AdminAuditLog";

/** The last 100 admin actions; `?target=user:<id>` narrows to one account. */
export const GET = withAdmin(async (request: NextRequest) => {
    const target = request.nextUrl.searchParams.get("target") ?? "";
    const filter = /^user:[a-f0-9]{24}$/i.test(target) ? { target } : {};
    const entries = await AdminAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    return NextResponse.json(
        { entries },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
