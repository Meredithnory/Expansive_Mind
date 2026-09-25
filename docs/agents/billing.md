# Billing and webhook

Checkout does not grant Pro.

`POST` `src/app/api/billing/checkout/route.ts` opens Stripe Checkout for the `PlanConfig` price id (`month` or `year`) and stores `userID` on the customer and the subscription metadata. The success URL is `/pricing?checkout=success`.

`POST` `src/app/api/billing/portal/route.ts` opens the billing portal. It does not change `plan`.

Pro is granted only by `POST` `src/app/api/billing/webhook/route.ts`.

- The handler reads the raw body and checks `stripe-signature` with `STRIPE_WEBHOOK_SECRET`. There is no auth cookie on this route.
- Idempotency is an insert into `src/app/models/BillingEvent.ts` by event id. A duplicate returns `{ received: true, duplicate: true }`. If the handler throws, that row is deleted so Stripe can retry.
- Handled types: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Any other type is acknowledged and ignored.
- `subscriptionUserUpdate` in `src/app/lib/billing-subscription.ts` maps status. `active` and `trialing` set `plan` to `pro`. Every other known status, and an unknown status stored as `none`, set `plan` to `free`.
- `pro` is kept only when the Stripe price id matches `PlanConfig`, or the unit amount and currency match. Otherwise the write is forced to `free`.
- Binding prefers an existing `stripeCustomerId`. Metadata `userID` may attach a customer that is not yet bound. It must not move a customer id onto a different user.

Stripe client and env price ids: `src/app/lib/stripe.ts`. After an admin price save, the webhook uses `getPlanConfig()`, not a hardcoded amount.

## Leave alone

- Do not set `plan` to `pro` in the checkout route or on `src/app/pricing/page.tsx`.
- Do not accept a webhook that fails the signature check.
- Do not log the raw Stripe payload.
