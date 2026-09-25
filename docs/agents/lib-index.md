# `src/app/lib` index

Read this instead of listing the directory. Files marked `server-only` must not be imported from client components.

| File | Side | One line |
| --- | --- | --- |
| `abstract-text.ts` | both | Flatten abstract fields to text |
| `admin.ts` | server | `withAdmin` + `isAdminUser` |
| `admin-audit.ts` | server | Persist admin actions |
| `admin-identity.ts` | both | Parse `ADMIN_EMAILS` |
| `admin-session.ts` | both | Admin session, MFA challenge, and auth cookie issuers |
| `admin-totp.ts` | server | Encrypt, QR, and verify admin TOTP |
| `billing-subscription.ts` | server | Map Stripe subscription → User fields |
| `canvas-image.ts` | client | Canvas → file, size cap |
| `chat-messages.ts` | both | Chat message shape + welcome copy |
| `claim-evidence.ts` | both | Study-design labels in Discover. Not the claim ledger |
| `contact.ts` | both | Contact form parse / mailto |
| `content-access-policy.ts` | both | License normalize + AI/display flags (CC0 / BY / BY-SA / BY-ND) |
| `quote-eligibility.ts` | both | Strict quote gate. Does not decide whether a share slug can be created |
| `entitlements.ts` | server | Quota consume / refund / snapshot |
| `evidence-type.ts` | both | Evidence labels on extractions |
| `figure-capture.ts` | both | Crop + rights attestation |
| `figure-context.ts` | both | Build figure prompt context |
| `figure-image.ts` | server | Validate / fetch figure bytes |
| `founder-report.ts` | both | Founder diligence markdown merged onto a Discover brief |
| `guest-cost-cap.ts` | server | Daily guest provider caps |
| `guest-discovery.ts` | client | localStorage last guest result |
| `guest-usage.ts` | both | Summarize guest counters |
| `highlight-search.tsx` | client | Highlight search UI helper |
| `license-extract.ts` | both | JATS license / DOI extract |
| `openrouter-policy.ts` | both | ZDR + deny data collection |
| `paper-citation.ts` | both | Locate excerpts / encode citations |
| `paper-context.ts` | both | Truncate paper text for the model |
| `paper-highlights.ts` | server | Highlight CRUD |
| `paper-sources.ts` | both | `nih \| springer \| scholar` IDs, paths, `PaperLocator` |
| `research-citation.ts` | both | DOI/PMCID normalize + citation merge keys for the source registry |
| `plan-config.ts` | server | Default + DB plan/price config |
| `password-reset-copy.ts` | both | Password-reset messages safe for client pages |
| `password-reset-mail.ts` | server | Send the reset link with Resend |
| `password-reset.ts` | server | Single-use reset token, link, and email theme |
| `pmc-media.ts` | both | PMC figure URL resolve |
| `project-types.ts` | both | Serialized research-plan types |
| `provider-cache.ts` | server | Short-lived provider cache |
| `quota-identity.ts` | server | Hash quota identity |
| `quota-period.ts` | both | Lifetime, UTC day, or UTC month for a quota feature |
| `rate-limit.ts` | server | Sliding window limiter |
| `region-capture.ts` | client | Selection → excerpt |
| `request-ip.ts` | server | Client IP from headers |
| `request-security.ts` | server | Origin check + limited JSON body |
| `saved-paper-utils.ts` | server | Find / migrate saved papers |
| `search-suggest.ts` | client | Ghost suggest + fetch helpers |
| `session-types.ts` | both | Session / quota snapshot types |
| `session-version.ts` | both | Revocable JWT `tokenVersion` |
| `share-slug.ts` | both | Public share slug helpers |
| `shared-brief.ts` | server | Load public shared brief, including a discovery claim ledger |
| `springer-media.ts` | both | Springer image URLs |
| `stripe.ts` | server | Stripe client + price IDs |
| `usage-meter.ts` | server | Record estimated AI cost |
| `use-inline-search-suggestion.ts` | client | Search bar ghost text |
| `use-session.tsx` | client | SessionProvider + PostHog identify |

Do **not** add a `lib/index.ts` barrel. It would mix `server-only` and client modules.
