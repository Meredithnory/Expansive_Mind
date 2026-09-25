# Conventions and forbidden patterns

## Follow

- TypeScript strict. Prefer explicit types on public helpers; avoid `any` in new code even though ESLint allows it.
- Server secrets and Stripe/OpenRouter stay in `server-only` modules or route handlers.
- Auth: `withAuth` / `withOptionalAuth` / `withAdmin`. Do not re-implement JWT verify.
- Paper identity: `src/app/lib/paper-sources.ts` (`buildPaperPath`, `normalizeStoredPaperId`). Do not hand-roll `/paperchatbot/...` URLs.
- License checks go through `evaluateContentAccess` / `canUseFigureImage`.
- Quotas go through `consumeQuota` + `resolvePlan`. Do not hardcode plan numbers in UI except to display the snapshot.
- Tests: Vitest, colocated `*.test.ts`. Mock `server-only`. Look at `src/app/api/discover/agent.test.ts` for the pattern.
- Package manager for this repo: **npm** (`package-lock.json`). `pnpm-lock.yaml` exists but is not the documented path.

## Forbidden

- Importing `src/app/lib/entitlements.ts`, `usage-meter.ts`, `stripe.ts`, or `admin.ts` from a client component (`server-only`).
- Adding a lib barrel (`index` file under `src/app/lib/`).
- Storing full article XML/HTML on User / SavedPaper / SavedDiscovery.
- Sending full papers to the model. Use `selectPaperContext` / licensed excerpts.
- Weakening `OPENROUTER_PROVIDER_POLICY` (`zdr: true`, `data_collection: "deny"`).
- New admin capability that skips `withAdmin` or `recordAdminAction`.
- Granting Pro in the checkout success page. Webhook only.
- Logging tokens, cookies, raw Stripe payloads, or paper full text.
- Expanding middleware `matcher` to all pages “just in case.”
- Rewriting god files when a helper next to them will do.
- Drive-by restyles, renames (`section-paser.ts`), or lockfile swaps unless that is the task.

## Naming

- Routes: kebab-case folders. Components: PascalCase files.
- Existing typo `section-paser.ts` is load-bearing — do not rename in a drive-by.
- Discover report contract: `src/app/api/discover/report-types.ts`.
- Discover client HTTP shape: `src/app/discover/discover-types.ts`.
