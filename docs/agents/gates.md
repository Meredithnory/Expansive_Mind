# Review, merge, deploy

```text
EM Builder implements
    → EM Reviewer reviews (this checklist)
        → e.m. assistant approves scope
            → Meredith approves if brand / security / money
                → human merge to master
                    → Vercel production (expansivemind.ai)
```

Agents do **not** merge. Wait for the GitHub Actions **CI** check (`.github/workflows/ci.yml`) to be green before merge. Reviewer still runs this checklist; local `npm test` / `npm run lint` are not a substitute for the PR check.

- Non-trivial work uses poteto-mode.
- Before claiming Discover or shareable brief done, run [verify-expansive-mind](../../.cursor/skills/verify-expansive-mind/SKILL.md).

## Reviewer checklist

1. Intent matches [product-intent.md](product-intent.md). No new marketing claims.
2. Files touched match [FEATURES.md](FEATURES.md). No god-file rewrite unless scoped.
3. Auth / quota / license / Stripe paths still go through the existing helpers.
4. Tests cover the new branch. `npm test` and `npm run lint` pass. Discover or brief claims also have verify-expansive-mind evidence.
5. `.env.example` updated if a new variable appeared. No secrets in the diff.
6. Agent docs still true. If a path moved, update FEATURES / architecture / lib-index.
7. Share / brief: no Share synthesis without every claim linked (home-full-text quote + citation + commercial-friendly home license URI). Unpaywall does not widen that license.

## Owner / e.m. approve when

- User-facing copy, pricing, entitlements, or `/admin` behavior
- Auth, session revocation, or `ADMIN_EMAILS` semantics
- `CONTENT_ACCESS_MODE` or what may be sent to a model
- New paid surface or Scholar/guest access change

## Deploy (Ops)

- Host: Vercel (`vercel.json` runs `npm install --legacy-peer-deps --include=dev` then `npm run build`).
- Confirm env in Vercel matches [env.md](env.md). `APP_URL` must be `https://expansivemind.ai` in production.
- Stripe webhook must hit `/api/billing/webhook` (`customer.subscription.created|updated|deleted`).
- After deploy: smoke `/discover`, `/searchpaper`, login, `/pricing` (test mode until Meredith says live).
- Do not run `migrate:saved-papers` unless Meredith/e.m. explicitly asked.
