export function configuredAdminEmails(value = process.env.ADMIN_EMAILS || "") {
    return value
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
}

export function isAdminIdentity(
    user?: { email?: string } | null,
    configured = process.env.ADMIN_EMAILS || "",
) {
    const email = String(user?.email || "")
        .trim()
        .toLowerCase();
    return Boolean(email) && configuredAdminEmails(configured).includes(email);
}
