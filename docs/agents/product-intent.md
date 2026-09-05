# Product intent

Verified facts below come from the running product and copy already in the repo. `OWNER-EDIT` blocks are Meredith-only. Agents: do not invent voice or promises to fill them.

## What it is (codebase fact)

Expansive Mind is a **discovery-first research workspace**. A user asks a biomedical question; the agent searches Springer Nature, NIH PubMed Central, and (capped, Pro) Google Scholar; then it returns a **cited opportunity report**. Every claim should lead back to a source paper. Saved papers, syntheses, and plans live in one Research Library.

Loop on `/about`: Discover → Evaluate → Read → Plan.

Home tagline in code: “Evidence, made actionable.”

## Non-negotiables (codebase fact)

- Answers can be wrong. **Not medical advice.**
- Do not store article bodies in Mongo. Saved papers store identifiers + metadata.
- AI goes through OpenRouter with **Zero Data Retention** (`src/app/lib/openrouter-policy.ts`).
- Full text / figures only when `content-access-policy` allows it (CC0 / CC BY, or `CONTENT_ACCESS_MODE=legacy`).
- Independent — not affiliated with NIH, Springer Nature, Google Scholar, SerpApi, or OpenRouter.
- Guest / Free / Pro quotas are real product limits, not UI decoration. Admin emails bypass quotas.
- Scholar search is an explicit **Pro** source, not a default for guests.

## Plans (code defaults in `plan-config.ts`)

| Plan | search | discover | chat | scholar_search | projects |
| --- | ---: | ---: | ---: | ---: | ---: |
| guest | 3 | 1 (lifetime) | 0 | 0 | 0 |
| free | 20 | 2 (lifetime) | 5 | 0 | 3 |
| pro | 300 | 40 | 100 | 25 | 50 |

Admin can override amounts in `/admin`. Researcher Pro list prices in code defaults: **$12 / month**, **$99 / year**. Stripe webhook — not the browser redirect — grants Pro.

## OWNER-EDIT: Voice

<!-- OWNER-EDIT:start voice -->
_Meredith: 5–8 lines on how Expansive Mind should sound. Example prompts: calm / precise / no hype / second person / never “revolutionary.”_
<!-- OWNER-EDIT:end voice -->

## OWNER-EDIT: Words we never use

<!-- OWNER-EDIT:start forbidden-words -->
_Meredith: list marketing words, medical claims, or competitor framing agents must not introduce._
<!-- OWNER-EDIT:end forbidden-words -->

## OWNER-EDIT: Visual brand

<!-- OWNER-EDIT:start visual -->
_Meredith: logo rules, color tokens (today: dark shell, Manrope, `#000` theme), what not to restyle._
<!-- OWNER-EDIT:end visual -->

## OWNER-EDIT: Product north star

<!-- OWNER-EDIT:start north-star -->
_Meredith: the one outcome that matters this quarter. What “done” looks like for a feature from your phone._
<!-- OWNER-EDIT:end north-star -->

## OWNER-EDIT: Money & security exceptions

<!-- OWNER-EDIT:start money-security -->
_Meredith: complimentary Pro policy, refund rules, who may be in `ADMIN_EMAILS`, when to flip `CONTENT_ACCESS_MODE=strict`._
<!-- OWNER-EDIT:end money-security -->
