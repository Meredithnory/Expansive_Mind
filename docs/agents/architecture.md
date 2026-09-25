# Architecture map

App Router lives under `src/app/`. Alias: `@/*` → `src/*`. Styles: SCSS modules. Data: MongoDB / Mongoose. Auth: JWT cookie `auth_token` (jose). AI: OpenAI SDK → OpenRouter.

## Routes

| Path | Auth | Purpose |
| --- | --- | --- |
| `/` | public | Marketing home |
| `/discover` | public (quota) | Product home for signed-in users |
| `/searchpaper` | public (quota) | Quick paper search |
| `/paperchatbot/[database]/[...paperId]` | public (guest caps) | Source-grounded reader |
| `/savedpapers` | **cookie** | Research Library |
| `/projects`, `/projects/[id]` | **cookie** | Research plans |
| `/brief/[slug]` | public | Shared synthesis |
| `/pricing` | public | Researcher Pro |
| `/login`, `/signup` | public; redirect if logged in | Auth |
| `/about`, `/get-started`, `/contact` | public | Marketing / contact |
| `/admin`, `/admin/usage` | **cookie + ADMIN_EMAILS** | Owner portal |

Middleware (`src/middleware.ts`) only matches `/savedpapers`, `/projects`, `/admin`, `/login`, `/signup`. API routes enforce auth themselves via `withAuth` / `withOptionalAuth` / `withAdmin`.

## Discover data flow

```text
UI DiscoverClient
  → POST /api/discover  (quota + rate limit + guest daily cap)
    → runDiscoverAgent
        1. judgeResearchQuestion
        2. expandDiscoveryQueries
        3. search via ResearchSource registry (Springer + NIH + Scholar; OpenAlex + Europe PMC when env is set)
        4. rank + select-candidates (AI-eligible only)
        5. load excerpts (content-access-policy); Scholar snippets stay discovery-only
        6. extractPaperFindings
        7. synthesizeOpportunityReport
        8. attachClaimLedger (gaps / problems / ventures → sourced rows + license URI)
    → persist SavedDiscovery (signed-in) or guest cache
  ← papers + brief + OpportunityReport (includes claimLedger)
UI may open /paperchatbot/... or seed /api/projects
Share (`POST /api/discover/share`) is rejected until every ledger claim has a quote from **home** OA full text, a resolvable paper citation, and a commercial-friendly **home** license URI (CC0, CC BY, CC BY-SA, or CC BY-ND). Unpaywall may locate OA URLs or flag a conflict; it must not fill a null home license for quotes. The Share path evaluates that license gate in `strict` mode even when `CONTENT_ACCESS_MODE=legacy`. Scholar/SerpApi is discovery/ranking only unless the hit remaps to NIH/Springer full text. Public `/brief/{slug}` carries that structured ledger.
```

## Auth & session

- Login/signup set `auth_token`. Payload: `id`, `email`, `tokenVersion`.
- `attachAuthenticatedUser` loads User and checks `session-version`.
- `tokenVersion` bump (password change / logout-all) revokes cookies.
- Client session: `use-session.tsx` → `GET /api/session`.

## Quotas & money

- Plans: `guest | free | pro` in `src/app/lib/plan-config.ts` (DB-overridable via `PlanConfig`).
- `consumeQuota` / `refundQuota` in `entitlements.ts`. Guests keyed by IP hash + daily provider caps (`guest-cost-cap.ts`).
- Stripe: checkout + portal + webhook. Webhook writes `plan` / subscription fields on User.
- Usage events: `usage-meter.ts` → `UsageEvent` (admin cost view).

## Models (`src/app/models/`)

User, SavedPaper, SavedDiscovery, Message, Project, PaperHighlight, PaperBrief, PlanConfig, UsageCounter, UsageEvent, RateLimit, ProviderCache, BillingEvent, AdminAuditLog.

## Key server helpers

| Concern | File |
| --- | --- |
| Auth wrappers | `src/app/api/authMiddleware.ts` |
| Admin wrapper | `src/app/lib/admin.ts` |
| CSRF-ish origin | `src/app/lib/request-security.ts` |
| Rate limit | `src/app/lib/rate-limit.ts` |
| License / AI-send | `src/app/lib/content-access-policy.ts`, `src/app/lib/quote-eligibility.ts` |
| Paper IDs / paths | `src/app/lib/paper-sources.ts` |
| Source registry | `src/app/api/research/registry.ts` |
| OpenRouter client | `src/app/api/openrouter.ts` |
| Mongo connect | `src/app/db/connectDB.ts` |

`src/app/api/paper/sources.ts` **re-exports** `lib/paper-sources` plus `fetchPaperBySource`. Prefer `lib/paper-sources` for IDs/paths.

## Analytics

PostHog init: `instrumentation-client.ts`. Events: `discovery_*`, `search_*`, `guest_discovery_upgrade_*`, `signup_completed`, checkout on `/pricing`, `identify` in `use-session`.
