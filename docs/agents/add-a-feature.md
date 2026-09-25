# How to add a feature

Use this checklist. e.m. assistant scopes which boxes apply before Builder starts.

## 1. Intent

- [ ] Feature exists (or clearly fits) in [FEATURES.md](FEATURES.md). If new, add one row.
- [ ] Change does not invent brand copy. New user-facing strings: Meredith `OWNER-EDIT` or e.m. approve.
- [ ] Money / quota / admin / license behavior: stop and get Meredith / e.m. approval.
- [ ] Discover share: claim ledger (home-full-text quote + citation + commercial-friendly home license URI) is the trust bar — reshape existing gaps/citations; do not rewrite the report. Unpaywall does not widen quotes.

## 2. Place the code

| Kind | Put it here | Not here |
| --- | --- | --- |
| Page | `src/app/<route>/page.tsx` + small client island | Root layout, NavBar (unless nav is required) |
| API | `src/app/api/<name>/route.ts` | Random `lib/` file that already does something else |
| Domain types | existing `*-types.ts` or `report-types.ts` | Duplicated inside a 1k-line island |
| Policy (quota, license, auth) | existing `entitlements` / `content-access-policy` / `authMiddleware` | New parallel allowlist |
| UI chrome | `src/app/components/` | Copy-paste from Chatbox/Paperbox |
| Persistence | new or existing Mongoose model in `src/app/models/` | Ad-hoc collections |

## 3. Server route rules

- Mutations: `withAuth` (or `withOptionalAuth` if guests are an explicit product decision).
- Admin: `withAdmin`.
- Call `hasValidMutationOrigin` + `readLimitedJsonBody` for JSON POST/PATCH/DELETE.
- Consume quota **before** expensive provider work; `refundQuota` on failure.
- Rate-limit by user id or `requestIp`. Guests: also `consumeGuestDailyCap` when the path exists.
- Do not persist article bodies. Store IDs, metadata, licensed excerpts only.

## 4. Client rules

- Keep the route `page.tsx` thin (params + Suspense). Heavy UI in a `*Client.tsx`.
- Session from `useSession()`, not a one-off `/api/session` fetch.
- SCSS module next to the island. No new CSS framework.
- PostHog: add an event only if the feature is user-visible and named like existing `discovery_*` / `search_*`.

## 5. Verify

- [ ] Colocated `*.test.ts` for logic you added or branched.
- [ ] `npm test` (includes agent-docs path check).
- [ ] `npm run lint`.
- [ ] Discover / brief / paper-reader work: run verify-expansive-mind before claiming done.
- [ ] If you touched FEATURES / architecture paths, the checker still passes.
- [ ] No `.env.local` values committed. New env vars: add to `.env.example` + [env.md](env.md).

## 6. Hand off

Builder opens/updates the PR. Reviewer uses [gates.md](gates.md). Do not merge.
