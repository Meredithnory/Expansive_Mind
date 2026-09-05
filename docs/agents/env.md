# Env and config

Canonical list: [`.env.example`](../../.env.example). Local file: `.env.local` (gitignored). README's inline env block is incomplete — trust `.env.example`.

| Variable | Used for |
| --- | --- |
| `MONGODB_URI` | Mongoose (`src/app/db/connectDB.ts`) |
| `JWT_SECRET` | Auth cookie + middleware |
| `RATE_LIMIT_SECRET` | Rate-limit hashing |
| `API_KEY` | NIH E-Utilities |
| `NCBI_EMAIL`, `NCBI_TOOL` | NCBI request identity (`NCBI_TOOL` defaults to `ExpansiveMind`) |
| `SPRINGER_API_KEY` | Springer Nature |
| `SERPAPI_KEY` | Google Scholar via SerpApi (Pro) |
| `OPENALEX_API_KEY` | Optional OpenAlex key. Unset + no mailto skips the adapter |
| `OPENALEX_MAILTO` | OpenAlex polite-pool contact when no API key |
| `UNPAYWALL_EMAIL` | Unpaywall DOI OA lookup. Unset skips the locator |
| `EUROPEPMC_EMAIL` | Enables Europe PMC search + NIH full-text XML fallback |
| `AI_API_KEY` | OpenRouter |
| `FIGURE_VISION_MODEL` | Figure chat model (default `openai/gpt-4.1-mini`) |
| `APP_URL` | Public origin; **required https in production** |
| `CONTENT_ACCESS_MODE` | `legacy` (default, reader/AI live access) or `strict`. Share / claim-ledger quotes always use the strict commercial-friendly gate |
| `STRIPE_SECRET_KEY` | Stripe SDK |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL` | Initial Researcher Pro prices |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Client analytics |
| `ADMIN_EMAILS` | Comma-separated owner allowlist (unlimited quota + `/admin`) |
| `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` | Contact form email |

Never commit secrets. New vars need a blank key in `.env.example` and a row here.
