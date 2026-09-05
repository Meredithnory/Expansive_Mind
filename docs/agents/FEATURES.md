# Feature index

Launch priority: Discover → shareable brief. Open the **entry** and **tests** first. Skip the “avoid” column unless the task is inside that file.

| Feature | UI entry | API / server | Shared types / lib | Tests | Avoid unless editing |
| --- | --- | --- | --- | --- | --- |
| Discover | `src/app/discover/page.tsx` | `src/app/api/discover/route.ts` → `agent.ts` | `src/app/discover/discover-types.ts`, `src/app/api/discover/report-types.ts`, `src/app/api/discover/claim-ledger.ts` | `src/app/api/discover/*.test.ts`, `src/app/discover/report-text.test.ts` | `DiscoverClient.tsx` (~1.3k), `OpportunityReportView.tsx` |
| Discover pipeline | — | `question-quality.ts` → `expand-queries.ts` → `research/registry.ts` → `select-candidates.ts` → `analyze.ts` → `synthesize.ts` | `src/app/lib/content-access-policy.ts`, `quote-eligibility.ts`, `paper-context.ts`, `research-citation.ts` | `agent.test.ts`, `question-quality.test.ts`, `synthesize.test.ts` | `src/app/api/search/utils.ts` |
| Search | `src/app/searchpaper/page.tsx` | `src/app/api/search/route.ts` → `research/registry.ts` | `src/app/lib/search-suggest.ts`, `paper-sources.ts` | `src/app/api/search/springer-query.test.ts` | `SearchPaperClient.tsx`, `search/utils.ts` |
| Research sources | — | `src/app/api/research/registry.ts` → adapters | `src/app/lib/research-citation.ts`, `paper-sources.ts` | `src/app/lib/research-citation.test.ts`, `src/app/api/research/*.test.ts` | `paper/utils.ts`, `search/utils.ts` |
| Paper reader | `src/app/paperchatbot/[database]/[...paperId]/page.tsx` | `src/app/api/paper/route.ts` | `src/app/lib/paper-sources.ts`, `paper-citation.ts` | `src/app/api/paper/load-paper.test.ts` | `paper/utils.ts` (~1k), `Paperbox.tsx`, `Chatbox.tsx` |
| Paper chat | `src/app/components/paperchatbot/Chatbox.tsx` | `src/app/api/aichat/route.ts` | `src/app/lib/chat-messages.ts`, `src/app/api/general-chat.ts` | `src/app/lib/chat-messages.test.ts` | `Chatbox.tsx` unless UI |
| Figure chat | same reader | `src/app/api/aichat/figure/route.ts` | `src/app/lib/figure-image.ts`, `figure-capture.ts` | `src/app/api/aichat/figure/route.test.ts` | — |
| Library | `src/app/savedpapers/page.tsx` | `src/app/api/all-user-papers/route.ts`, `delete-paper`, `highlights` | `src/app/lib/saved-paper-utils.ts` | `src/app/api/highlights/route.test.ts` | — |
| Projects / plans | `src/app/projects/[id]/page.tsx` | `src/app/api/projects/route.ts`, `[id]/route.ts`, `[id]/research` | `src/app/lib/project-types.ts` | `generate-plan.test.ts`, `generate-briefing.test.ts` | `ProjectDetailClient.tsx` |
| Share / brief | `src/app/brief/[slug]/page.tsx` | `src/app/api/discover/share/route.ts`, `src/app/api/brief/route.ts` | `src/app/lib/share-slug.ts`, `shared-brief.ts`, `quote-eligibility.ts`, `src/app/api/discover/claim-ledger.ts` | `src/app/api/discover/share/route.test.ts`, `src/app/api/discover/claim-ledger.test.ts`, `src/app/lib/quote-eligibility.test.ts` | — |
| Auth / session | `src/app/login/page.tsx`, `signup` | `src/app/api/login`, `signup`, `logout`, `session`, `account/password` | `src/app/api/authMiddleware.ts`, `src/app/lib/use-session.tsx`, `session-version.ts` | `src/middleware.test.ts`, `session-version.test.ts` | — |
| Billing | `src/app/pricing/page.tsx` | `src/app/api/billing/checkout`, `portal`, `webhook` | `src/app/lib/stripe.ts`, `billing-subscription.ts`, `plan-config.ts` | `billing-subscription.test.ts`, `stripe-webhook-signature.test.ts` | — |
| Quotas | — | consumed in discover/search/chat/projects routes | `src/app/lib/entitlements.ts`, `guest-usage.ts`, `guest-cost-cap.ts` | `entitlements.test.ts`, `guest-*.test.ts` | — |
| Admin | `src/app/admin/page.tsx`, `admin/usage` | `src/app/api/admin/*` | `src/app/lib/admin.ts`, `admin-identity.ts`, `admin-audit.ts` | `admin.test.ts`, `admin-identity.test.ts` | — |
| Contact | `src/app/contact/page.tsx` | `src/app/api/contact/route.ts` | `src/app/lib/contact.ts` | `src/app/lib/contact.test.ts` | — |
| Analytics | `instrumentation-client.ts` | — | PostHog in Discover/Search/pricing/signup/`use-session` | — | — |
| Marketing pages | `src/app/page.tsx`, `about`, `get-started` | — | copy is product-intent | — | restyle without OWNER-EDIT |
| Agent verification | `.cursor/skills/verify-expansive-mind/SKILL.md` | doctor script in that skill | feature map next to the skill | — | product runtime |

**Share bar:** claim ledger rows need a home-full-text quote, a resolvable citation, and a commercial-friendly home license URI. Unpaywall does not widen quotes. See [product-intent.md](product-intent.md).

## God files (do not load for orientation)

| File | Lines (approx) | Why it exists |
| --- | ---: | --- |
| `src/app/discover/DiscoverClient.tsx` | 1300 | Discover island: history, run, share, upgrade |
| `src/app/api/paper/utils.ts` | 1020 | NIH / Springer / Scholar fetch + parse |
| `src/app/components/paperchatbot/Chatbox.tsx` | 950 | Reader chat UI |
| `src/app/components/paperchatbot/Paperbox.tsx` | 690 | Paper body, highlights, figures |
| `src/app/api/articleParser.ts` | 660 | JATS / HTML article parse |
| `src/app/searchpaper/SearchPaperClient.tsx` | 640 | Search island |
| `src/app/projects/[id]/ProjectDetailClient.tsx` | 630 | Plan detail |
| `src/app/discover/OpportunityReportView.tsx` | 620 | Report rendering |
| `src/app/api/discover/agent.ts` | 600 | Discover orchestration |
| `src/app/api/search/utils.ts` | 600 | Multi-source search |

Prefer the split modules around these files (`analyze.ts`, `load-paper.ts`, `discover-types.ts`) instead of the island.
