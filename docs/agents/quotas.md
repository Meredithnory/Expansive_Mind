# Quotas and guest caps

Defaults: `PLAN_ENTITLEMENTS` in `src/app/lib/plan-config.ts`. Periods: `src/app/lib/quota-period.ts`. Consume, refund, and snapshot: `src/app/lib/entitlements.ts`. Guest provider brake: `src/app/lib/guest-cost-cap.ts`. Guest counter summary: `src/app/lib/guest-usage.ts`.

| Plan | search | discover | chat | scholar_search | projects |
| --- | ---: | ---: | ---: | ---: | ---: |
| guest | 3 | 1 | 0 | 0 | 0 |
| free | 20 | 2 | 5 | 0 | 3 |
| pro | 300 | 20 | 100 | 25 | 50 |

`/admin` may store overrides on `PlanConfig`. `applyStoredPlanConfig` will not lower guest `discover` under the code default, and a stored pro `discover` of 40 is rewritten to 20. Code list prices are 1200 and 9900 cents. Leave both alone.

`resolvePlan`: no user is `guest`. `accessOverride === "pro"` is `pro`. Otherwise `pro` requires `plan === "pro"` and status `active` or `trialing`. Any other signed-in user is `free`.

Periods: guest and free `discover` and `projects` are `lifetime`. Other guest features are a UTC day. Every remaining feature is a UTC month. `unlimited: true` (admin email) skips the counter.

`consumeGuestDailyCap` is a separate IP rate limit. Signed-in users skip it. Limits per 24 hours: discover 1 (`src/app/api/discover/route.ts`), search 3 (`src/app/api/search/route.ts`), paper 12 (`src/app/api/paper/route.ts`). Discover also rate-limits before that cap and before `consumeQuota`: guest 2, signed-in 5, per 10 minutes.

Scholar on `/api/search`: `sourceFilter === "scholar"` returns `PRO_REQUIRED` when `scholar_search` is 0, then consumes both `search` and `scholar_search`. Discover includes Scholar whenever `SERPAPI_KEY` is set and does not consume `scholar_search`. Snippets still never become synthesis text. See [discover-pipeline.md](discover-pipeline.md).

Consume quota before provider work. Discover refunds on `noResults` and on a thrown failure. A cache hit still counts. The reservation clears only after a saved or guest result is returned.

A paper brief consumes `chat`, not `discover`. See [briefs.md](briefs.md).

## Leave alone

- Do not copy these numbers into a new helper. Read `getPlanEntitlements`.
- Do not treat the guest daily cap and the quota counter as one bucket.
- Do not grant Pro from a quota check. The plan comes from `resolvePlan`.
