import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import {
    hasValidMutationOrigin,
    trustedApplicationOrigin,
} from "../../../lib/request-security";
import { getStripe } from "../../../lib/stripe";
import User from "../../../models/User";
import { getPlanConfig } from "../../../lib/plan-config";

export const POST = withAuth(async (request: NextRequest) => {
    try {
        if (!hasValidMutationOrigin(request)) {
            return NextResponse.json(
                { error: "Invalid origin." },
                { status: 403 },
            );
        }

        const body = await request.json().catch(() => ({}));
        const interval = body.interval === "year" ? "year" : "month";
        const stripe = getStripe();
        const priceId = (await getPlanConfig()).prices[interval].stripePriceId;
        if (!priceId) {
            throw new Error(`Stripe ${interval} price is not configured.`);
        }
        let customerId = request.user.stripeCustomerId as string | undefined;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: request.user.email,
                name: `${request.user.firstName} ${request.user.lastName}`.trim(),
                metadata: { userID: request.user._id.toString() },
            });
            customerId = customer.id;
            await User.updateOne(
                { _id: request.user._id },
                { $set: { stripeCustomerId: customerId } },
            );
        }

        const origin = trustedApplicationOrigin(request);
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            allow_promotion_codes: true,
            client_reference_id: request.user._id.toString(),
            metadata: { userID: request.user._id.toString() },
            subscription_data: {
                metadata: { userID: request.user._id.toString() },
            },
            success_url: `${origin}/pricing?checkout=success`,
            cancel_url: `${origin}/pricing?checkout=canceled`,
        });

        return NextResponse.json({ url: session.url });
    } catch {
        console.error("Stripe checkout creation failed");
        return NextResponse.json(
            { error: "Billing checkout is unavailable." },
            { status: 503 },
        );
    }
});
