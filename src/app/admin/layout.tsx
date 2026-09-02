import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import connectDB from "../db/connectDB";
import User from "../models/User";
import { isAdminUser } from "../lib/admin";
import { sessionVersionMatches } from "../lib/session-version";

async function hasCurrentAdminSession() {
    const token = (await cookies()).get("auth_token")?.value;
    if (!token || !process.env.JWT_SECRET) return false;

    try {
        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(process.env.JWT_SECRET),
            { algorithms: ["HS256"] },
        );
        if (typeof payload.id !== "string") return false;
        await connectDB();
        const user = await User.findById(payload.id);
        return Boolean(
            user &&
                sessionVersionMatches(
                    payload.tokenVersion,
                    user.tokenVersion,
                ) &&
                isAdminUser(user),
        );
    } catch {
        return false;
    }
}

export default async function AdminLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    if (!(await hasCurrentAdminSession())) {
        redirect("/login");
    }
    return children;
}
