# `src/app/lib` index

Read this instead of listing the directory. Files marked `server-only` must not be imported from client components.

| File | Side | One line |
| --- | --- | --- |
| `abstract-text.ts` | both | Flatten abstract fields to text |
| `activity.ts` | both | `/admin/live`: page views + discover/search steps (validate, feed wording), who is on the site now, and a fire-and-forget `logActivity` for `/api/activity` |
| `admin-email.ts` | both | Parse and render an `/admin/email` message; group sends carry an unsubscribe link |
| `admin-pulse.ts` | both | `/admin` pulse helpers: range, question-to-brief funnel, question topics |
| `admin.ts` | server | `withAdmin` + `isAdminUser` |
| `admin-audit.ts` | server | Persist admin actions |
| `admin-identity.ts` | both | Parse `ADMIN_EMAILS` |
| `admin-session.ts` | both | Admin session, MFA challenge, and auth cookie issuers |
| `admin-totp.ts` | server | Encrypt, QR, and verify admin TOTP |
| `audience-visitor.ts` | server | The anonymous `em_audience` visit cookie and its scrambled key, shared by `/api/audience`, `/api/activity`, `/api/ratings` |
| `billing-subscription.ts` | server | Map Stripe subscription → User fields |
| `brief-view.ts` | both | Shared topic brief view model: summary chips that open the cited sentence, gaps, papers, counts |
| `browser-paper.ts` | client | Load an unlicensed PMC body in the reader's browser from NIH / Europe PMC. Read-only figures |
| `canvas-image.ts` | client | Canvas → file, size cap |
| `chat-access.ts` | both | `paperChatMode`: body excerpts, abstract only, or no chat |
| `chat-messages.ts` | both | Chat message shape + welcome copy |
| `cited-text.ts` | both | Report citation parsing: `[Paper 3]`, `[Papers 2, 5]`, `[10]` to chips; evidence ids `[E3.2]` to plain citations plus a per-chip evidence map |
| `claim-evidence.ts` | both | Study-design labels in Discover. Not the claim ledger |
| `contact.ts` | both | Contact form parse / mailto |
| `contact-mail.ts` | both | Contact emails: the message to Meredith and the "we got your message" reply (never echoes the message) |
| `email-layout.ts` | both | Branded HTML email shell (light inline default; dark through `prefers-color-scheme` and `EMAIL_CLASS` hooks), escaping, and the default sender (`support@expansivemind.ai`) |
| `email-unsubscribe.ts` | server | Signed unsubscribe tokens and links for product email |
| `paper-scope.ts` | both | `narrowerScope`: note a paper only when it studied a narrower group (livestock, mice, cell lines) than the question |
| `product-signals.ts` | both | Allowed product signal keys and a fire-and-forget sender for `/api/signals` |
| `send-email.ts` | server | Sends one email through Resend; never throws |
| `content-access-policy.ts` | both | License normalize + AI/display flags (CC0 / BY / BY-SA / BY-ND) |
| `quote-eligibility.ts` | both | Strict quote gate. Does not decide whether a share slug can be created |
| `quote-citation.ts` | both | "Copy with citation": quote + byline, DOI link, license |
| `entitlements.ts` | server | Quota consume / refund / snapshot |
| `evidence-type.ts` | both | Evidence labels on extractions |
| `figure-capture.ts` | both | Crop + rights attestation |
| `figure-context.ts` | both | Build figure prompt context |
| `figure-image.ts` | server | Validate / fetch figure bytes |
| `founder-report.ts` | both | Founder diligence markdown merged onto a Discover brief |
| `gap-activity.ts` | both | Sanitize gap registry terms, build RePORTER / ClinicalTrials.gov query, parse stored gap activity |
| `google-auth-messages.ts` | client | Google sign-in error copy |
| `google-oauth.ts` | server | Google authorize URL, state cookie, and verified email |
| `guest-cost-cap.ts` | server | Daily guest provider caps |
| `guest-discovery.ts` | client | localStorage last guest result |
| `guest-usage.ts` | both | Summarize guest counters |
| `highlight-search.tsx` | client | Highlight search UI helper |
| `lab-badge.ts` | both | Lab badge roles, extras slots, validation, tag line |
| `license-extract.ts` | both | JATS license / DOI extract |
| `newsletter.ts` | both | `NEWSLETTER_OPT_IN_VISIBLE`: shows the newsletter opt-in on signup and Profile (off until newsletters start) |
| `openrouter-policy.ts` | both | ZDR + deny data collection |
| `paper-citation.ts` | both | Locate excerpts / encode citations |
| `paper-context.ts` | both | Truncate paper text for the model |
| `paper-evidence.ts` | both | Verify a finding's quote is verbatim in the excerpt; pick the evidence sentence a clicked citation opens; `closestSentence` finds the paper's best match for a claim with no recorded sentence (labeled as a match in the panel) |
| `paper-highlights.ts` | server | Highlight CRUD |
| `paper-sources.ts` | both | `nih \| springer \| scholar` IDs, paths, `PaperLocator` |
| `profile-colors.ts` | both | Coat colors (profileColor) with shade and ink |
| `research-citation.ts` | both | DOI/PMCID normalize + citation merge keys for the source registry |
| `plan-config.ts` | server | Default + DB plan/price config |
| `pmc-media.ts` | both | PMC figure URL resolve |
| `project-types.ts` | both | Serialized research-plan types |
| `provider-cache.ts` | server | Short-lived provider cache |
| `quota-identity.ts` | server | Hash quota identity |
| `quota-period.ts` | both | Lifetime, UTC day, or UTC month for a quota feature |
| `rate-limit.ts` | server | Sliding window limiter |
| `rating.ts` | both | "How is Expansive Mind doing?" Bad / Fine / Good: scores, surfaces, 3-day cooldown, input cleanup, and `askForRating` for pages |
| `region-capture.ts` | client | Selection → excerpt |
| `request-ip.ts` | server | Client IP from headers |
| `replay-privacy.ts` | both | PostHog recording class names: `REPLAY_MASK` on paper text (body, abstract, quotes, highlights, chats), `REPLAY_BLOCK` on the admin portal |
| `request-security.ts` | server | Origin check + limited JSON body |
| `saved-paper-utils.ts` | server | Find / migrate saved papers |
| `scroll-to-range.ts` | client | Scroll a focused passage to the reading line by its own position |
| `search-filters.ts` | both | Search source/date filters; date filter → publication-year range for `/api/search` |
| `search-result-view.ts` | both | Search result row labels: source, year, access chip, open action, counts, searches left |
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
