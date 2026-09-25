# Discover pipeline

Orchestration is `runDiscoverAgent` in `src/app/api/discover/agent.ts`. HTTP, quota, cache, and the founder merge are `src/app/api/discover/route.ts`. UI types are `src/app/discover/discover-types.ts`. The report contract is `src/app/api/discover/report-types.ts`.

## Order

1. `judgeResearchQuestion` in `src/app/api/discover/question-quality.ts`. A non-research question returns empty (`noResults`). The route refunds quota. Query expansion does not run.
2. `expandDiscoveryQueries` in `src/app/api/discover/expand-queries.ts` (at most 4 sub-queries).
3. `retrieve` in `src/app/api/research/registry.ts`. Homes: NIH, Springer, and Scholar when `SERPAPI_KEY` is set. Indexes: OpenAlex and Europe PMC, homed to NIH by PMCID in `src/app/api/research/homing.ts`. `homeLead` returns null without a PMCID. Unpaywall is an OA locator. `hasConfiguredLiteratureSource` ignores that lane.
4. Rank, then `selectDiscoverCandidates` in `src/app/api/discover/select-candidates.ts`. Keep `access.canSendToAI`, dedupe by DOI or id, cap at `TARGET_PAPER_COUNT` (10). `MIN_SPRINGER_BEFORE_NIH_FILL` is deprecated. NIH is searched on every run.
5. `readPaperExcerpts` in `src/app/api/discover/agent.ts`. Scholar snippets and papers that fail `canSendToAI` are dropped. Quote text uses `evaluateQuoteEligibility` (`src/app/lib/quote-eligibility.ts`), always in strict mode. `shouldDropForOaConflict` can drop a paper. Unpaywall does not fill a null home license.
6. `extractPaperFindings` in `src/app/api/discover/analyze.ts`. A failed extraction becomes `fallbackPaperExtraction`. The supporting excerpt comes only from `quoteExcerpt`.
7. `synthesizeOpportunityReport` in `src/app/api/discover/synthesize.ts`.
8. `attachClaimLedger` in `src/app/api/discover/claim-ledger.ts`.

If the first retrieval is empty, the agent may apply one NIH spelling suggestion (`src/app/api/discover/discovery-query.ts`) and retrieve again.

The route then runs `src/app/api/discover/founder-diligence.ts` beside the literature run and merges `src/app/lib/founder-report.ts` into `report.founder` and the markdown `brief`. That merge stores `report` as `{ sections, founder }`. The public brief rebuilds the ledger. See [claim-ledger.md](claim-ledger.md).

Provider cache: namespace `discovery-v6-claim-passages`, 24 hours, keyed by the normalized question, in `src/app/lib/provider-cache.ts`. Quota is taken before that lookup.

Tests: `src/app/api/discover/agent.test.ts`, `src/app/api/discover/route-gates.test.ts`.

## Leave alone

- Do not reconstruct this sequence from `DiscoverClient.tsx`.
- Do not send Scholar snippets to the model, and do not treat SerpApi as a full-text home.
- Do not treat Unpaywall as enough to run Discover.
- Do not fold founder diligence into `runDiscoverAgent`.
- Do not persist article bodies. Cards store ids, metadata, and licensed excerpts.
