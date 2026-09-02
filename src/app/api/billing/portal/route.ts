import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import { getStripe } from "../../../lib/stripe";

export const POST = withAuth(async (request: NextRequest) => {
    try {
        if (!hasValidMutationOrigin(request)) {
            return NextResponse.json(
                { error: "Invalid origin." },
                { status: 403 },
            );
        }
        if (!request.user.stripeCustomerId) {
            return NextResponse.json(
                { error: "No billing account exists for this user." },
                { status: 404 },
            );
        }

        const origin =
            process.env.APP_URL ||
            request.headers.get("origin") ||
            request.nextUrl.origin;
        const session = await getStripe().billingPortal.sessions.create({
            customer: request.user.stripeCustomerId,
            return_url: `${origin}/pricing`,
        });
        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error("Stripe portal creation failed", error);
        return NextResponse.json(
            { error: "Billing portal is unavailable." },
            { status: 503 },
        );
    }
});
