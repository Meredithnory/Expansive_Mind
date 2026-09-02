import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import mongoose from "mongoose";
import connectDB from "../../../db/connectDB";
import BillingEvent from "../../../models/BillingEvent";
import User from "../../../models/User";
import { getStripe } from "../../../lib/stripe";
import { subscriptionUserUpdate } from "../../../lib/billing-subscription";

export const runtime = "nodejs";

async function syncSubscription(subscription: Stripe.Subscription) {
    const update = subscriptionUserUpdate(subscription);
    const customerUser = await User.findOne({
        stripeCustomerId: update.customerId,
    }).select({ _id: 1 });

    if (customerUser) {
        if (
            update.userID &&
            String(customerUser._id) !== update.userID
        ) {
            throw new Error("Stripe subscription identity mismatch.");
        }
        await User.updateOne(
            { _id: customerUser._id, stripeCustomerId: update.customerId },
            { $set: update.values },
        );
        return;
    }

    // Metadata can bootstrap older customers, but it may never overwrite a
    // customer binding that already belongs to another app account.
    if (!update.userID || !mongoose.isValidObjectId(update.userID)) {
        throw new Error("Stripe subscription has no valid account binding.");
    }
    const result = await User.updateOne(
        {
            _id: update.userID,
            $or: [
                { stripeCustomerId: { $exists: false } },
                { stripeCustomerId: null },
                { stripeCustomerId: update.customerId },
            ],
        },
        { $set: update.values },
    );
    if (result.matchedCount !== 1) {
        throw new Error("Stripe subscription account binding was rejected.");
    }
}

export async function POST(request: NextRequest) {
    const signature = request.headers.get("stripe-signature");
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
        return NextResponse.json(
            { error: "Webhook is not configured." },
            { status: 400 },
        );
    }

    let event: Stripe.Event;
    try {
        event = getStripe().webhooks.constructEvent(
            await request.text(),
            signature,
            process.env.STRIPE_WEBHOOK_SECRET,
        );
    } catch {
        return NextResponse.json(
            { error: "Invalid webhook signature." },
            { status: 400 },
        );
    }

    await connectDB();
    const claimed = await BillingEvent.findOneAndUpdate(
        { _id: event.id },
        { $setOnInsert: { type: event.type, processedAt: new Date() } },
        { upsert: true, new: false },
    );
    if (claimed) {
        return NextResponse.json({ received: true, duplicate: true });
    }

    try {
        if (
            event.type === "customer.subscription.created" ||
            event.type === "customer.subscription.updated" ||
            event.type === "customer.subscription.deleted"
        ) {
            await syncSubscription(event.data.object);
        }
        return NextResponse.json({ received: true });
    } catch (error) {
        await BillingEvent.deleteOne({ _id: event.id });
        console.error("Stripe webhook processing failed", error);
        return NextResponse.json(
            { error: "Webhook processing failed." },
            { status: 500 },
        );
    }
}
