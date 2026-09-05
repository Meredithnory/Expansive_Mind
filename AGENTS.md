# Expansive Mind — agent entry

Production: [expansivemind.ai](https://expansivemind.ai). Default branch: `master`. Next.js 15 App Router.

Meredith decides **brand, product, security, and money** (usually from her phone). e.m. assistant coordinates. EM Builder / Reviewer / Ops do the technical work. Do not invent voice, pricing, or access rules.

- **Launch north star** (locked 2026-09-05): Discover to shareable brief. Full wording in [`docs/agents/product-intent.md`](docs/agents/product-intent.md).

## Read first (stop when you can act)

1. This file
2. [`docs/agents/product-intent.md`](docs/agents/product-intent.md) — owner brain + verified product facts
3. [`docs/agents/FEATURES.md`](docs/agents/FEATURES.md) — feature → files. Open **only** those paths.
4. Task doc from the index below, if needed

Do **not** grep the whole repo to orient. Do **not** open the god files unless you are editing them.

## Docs index

| Doc | When |
| --- | --- |
| [product-intent.md](docs/agents/product-intent.md) | Copy, positioning, OWNER-EDIT brand brain |
| [FEATURES.md](docs/agents/FEATURES.md) | Locate a feature's files |
| [architecture.md](docs/agents/architecture.md) | Routes, data flow, auth/quota |
| [lib-index.md](docs/agents/lib-index.md) | One line per `src/app/lib` module |
| [add-a-feature.md](docs/agents/add-a-feature.md) | Shipping a new capability |
| [conventions.md](docs/agents/conventions.md) | Required and forbidden patterns |
| [gates.md](docs/agents/gates.md) | Builder → Reviewer → approve → merge |
| [token-efficiency.md](docs/agents/token-efficiency.md) | What to read / skip |
| [env.md](docs/agents/env.md) | Env vars (source: `.env.example`) |

## Roles

| Role | Decides / does |
| --- | --- |
| Meredith (owner) | Brand, product intent, security exceptions, money, go-live |
| e.m. assistant | Scope, which files to touch, whether human approval is needed |
| EM Builder | Implement against this OS; keep diffs small |
| EM Reviewer | Check intent, security, tests, doc drift — not restyle |
| EM Ops | Env, Vercel, Stripe webhook, deploy verification |

## Cheap verification

```bash
npm test
npm run lint
```

`npm test` includes the agent-docs path check. GitHub Actions (`.github/workflows/ci.yml`) runs `lint`, `test`, and `check:agent-docs` on pull requests and on push to `master`. Builder/Reviewer must wait for the green check before merge.

## Hard stops (Meredith / e.m. only)

- Pricing, entitlements, Stripe price IDs, complimentary Pro
- `ADMIN_EMAILS`, auth cookies, session invalidation
- `CONTENT_ACCESS_MODE` and license/AI-send policy
- Public marketing copy and brand voice (`OWNER-EDIT` sections)
- Secrets (never commit `.env.local`)
