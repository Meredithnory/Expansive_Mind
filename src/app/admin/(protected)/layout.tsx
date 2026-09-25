import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import connectDB from "../../db/connectDB";
import User from "../../models/User";
import { isAdminUser } from "../../lib/admin";
import {
    ADMIN_SESSION_COOKIE,
    readAdminSession,
} from "../../lib/admin-session";

async function hasValidAdminSession() {
    const adminSession = await readAdminSession(
        (await cookies()).get(ADMIN_SESSION_COOKIE)?.value,
    );
    if (!adminSession) return false;

    try {
        await connectDB();
        const user = await User.findById(adminSession.id);
        return Boolean(user && isAdminUser(user));
    } catch {
        return false;
    }
}

export default async function ProtectedAdminLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    if (!(await hasValidAdminSession())) {
        redirect("/admin/login");
    }
    return children;
}
