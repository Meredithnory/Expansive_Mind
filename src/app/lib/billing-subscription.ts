import type Stripe from "stripe";

const subscriptionStatuses = new Set([
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
]);

export function subscriptionUserUpdate(subscription: Stripe.Subscription) {
    const customerId =
        typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
    const item = subscription.items.data[0];
    const subscriptionStatus = subscriptionStatuses.has(subscription.status)
        ? subscription.status
        : "none";
    const active =
        subscriptionStatus === "active" ||
        subscriptionStatus === "trialing";

    return {
        customerId,
        userID: subscription.metadata.userID,
        values: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            stripePriceId: item?.price?.id,
            subscriptionStatus,
            subscriptionCurrentPeriodEnd: item?.current_period_end
                ? new Date(item.current_period_end * 1_000)
                : undefined,
            plan: active ? ("pro" as const) : ("free" as const),
        },
    };
}
