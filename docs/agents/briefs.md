# Briefs

Three writers. The first two share one public URL.

| Kind | What it is | Where | Public |
| --- | --- | --- | --- |
| Discover brief | Opportunity report plus markdown for one question | `runDiscoverAgent`, then `src/app/models/SavedDiscovery.ts`. Slug rules: [claim-ledger.md](claim-ledger.md) | `findSharedBrief` kind `discovery` |
| Paper brief | Distill of one paper | `POST` `src/app/api/brief/route.ts` → `synthesizePaperBrief` in `src/app/api/brief/synthesize-brief.ts` → `src/app/models/PaperBrief.ts` | `findSharedBrief` kind `paper` |
| Project briefing | Next-move JSON for a plan | `src/app/api/projects/generate-briefing.ts` | Not a `/brief` slug |

Loader: `src/app/lib/shared-brief.ts`. Page: `src/app/brief/[slug]/page.tsx`. Slug check: `isValidShareSlug` in `src/app/lib/share-slug.ts`. Paper briefs are looked up before discoveries.

Paper brief: signed-in only. It consumes the `chat` quota, not `discover`. The loaded paper must have `canSendToAI` and `canPersistContent`. One row per user per paper; regenerate overwrites the text and keeps the slug from insert. Guests have `chat: 0`.

Discover brief: a guest result is a 24-hour cache entry (`guest-discovery-last` via `src/app/lib/provider-cache.ts`), not a shareable id. Share needs a real ObjectId. The route appends founder markdown onto `brief` after synthesis. That string is not the paper-brief template.

`src/app/lib/claim-evidence.ts` labels study design in the Discover UI. It does not write a brief and it is not the ledger.

## Leave alone

- Do not send both share actions to one route.
- Do not store a paper brief on `SavedDiscovery`, or a discovery brief on `PaperBrief`.
- Do not run project briefing through `/api/brief`.
