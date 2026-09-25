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
- Full text / figures only when `content-access-policy` allows it (CC0 / CC BY / CC BY-SA / CC BY-ND, or `CONTENT_ACCESS_MODE=legacy`). Share and claim-ledger quotes always use the strict commercial-friendly gate on the **home** full-text license (NIH/Springer JATS or publisher JSON): not NC licenses, null/unknown home licenses, abstracts, or Scholar snippets. Unpaywall may locate OA URLs or flag a conflict; it must not authorize quotes when the home license is null.
- Independent — not affiliated with NIH, Springer Nature, Google Scholar, SerpApi, or OpenRouter.
- Guest / Free / Pro quotas are real product limits, not UI decoration. Admin emails bypass quotas.
- Scholar search is an explicit **Pro** source, not a default for guests.

## Plans (code defaults in `plan-config.ts`)

| Plan | search | discover | chat | scholar_search | projects |
| --- | ---: | ---: | ---: | ---: | ---: |
| guest | 3 | 1 (lifetime) | 0 | 0 | 0 |
| free | 20 | 2 (lifetime) | 5 | 0 | 3 |
| pro | 300 | 20 | 100 | 25 | 50 |

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
**Locked 2026-09-05 (Meredith).** Discover to shareable brief for biomedical researchers: fuzzy question → cited opportunity report → shareable brief. Other surfaces (search, reader chat, projects/plans) serve that wedge and must not compete with it this launch.

**Share synthesis** is available once a Discover run is saved for a signed-in user. Claim-excerpt completeness does not block the share link. Quote/license rules for displaying paper body on shared pages remain separate from link creation.

**Build framing:** Discover → shareable brief is the launch wedge. REFINE Discover→Brief vs Elicit/Undermind.

**First-50 validation:** mix of ECR personal pay and PI/lab. Learn which mix holds in a concierge test. Do not assume a single buyer.
<!-- OWNER-EDIT:end north-star -->

## OWNER-EDIT: Money & security exceptions

<!-- OWNER-EDIT:start money-security -->
**First-50 customers:** mix of ECR personal pay and PI/lab — learn in validation (concierge test). Do not lock a single ICP or invent a first-50 discount / complimentary-Pro path from this mix.

Complimentary Pro, refunds, who may be in `ADMIN_EMAILS`, and when to flip `CONTENT_ACCESS_MODE=strict` remain owner decisions — do not invent them.
<!-- OWNER-EDIT:end money-security -->

## Product rules (locked)

- Share synthesis for a signed-in saved discovery does not wait on claim-excerpt completeness. Ledger shape and the quote gate: [claim-ledger.md](claim-ledger.md) and [content-access.md](content-access.md).
- The ledger reshapes existing gaps, problems, and ventures. Do not rewrite the opportunity report to get rows.
- Quota numbers, including the stored pro-discover `40` coercion back to 20: [quotas.md](quotas.md).