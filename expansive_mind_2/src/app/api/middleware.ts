// middleware.ts
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
    publicRoutes: ["/api/aichat"],
});

export const config = {
    matcher: ["/api/:path*"], // or whatever your current matcher is
};
