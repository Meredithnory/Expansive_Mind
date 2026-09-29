# Discover pipeline

Orchestration is `runDiscoverAgent` in `src/app/api/discover/agent.ts`. HTTP, quota, cache, and the founder merge are `src/app/api/discover/route.ts`. UI types are `src/app/discover/discover-types.ts`. The report contract is `src/app/api/discover/report-types.ts`.

## Order

1. `judgeResearchQuestion` in `src/app/api/discover/question-quality.ts`. A non-research question returns empty (`noResults`). The route refunds quota. Query expansion does not run.
2. `expandDiscoveryQueries` in `src/app/api/discover/expand-queries.ts` (at most 4 sub-queries).
3. `retrieve` in `src/app/api/research/registry.ts`. Homes: NIH, Springer, and Scholar when `SERPAPI_KEY` is set. Indexes: OpenAlex and Europe PMC, homed to NIH by PMCID in `src/app/api/research/homing.ts`. `homeLead` returns null without a PMCID. Unpaywall is an OA locator. `hasConfiguredLiteratureSource` ignores that lane.
4. Rank with `rankSearchResults` (`src/app/api/search/semantic-rank.ts`, shared with Search): word match (title only when a hit has no abstract, never a penalty), an embedding score for the best `SEMANTIC_POOL_SIZE` (40) by word match, and each source's own order counted within that source. No source is forced first. Then `selectDiscoverCandidates` in `src/app/api/discover/select-candidates.ts`. Keep papers that pass `access.canSendToAI`, plus non-Scholar papers with an abstract (`isDiscoverUsable`). Dedupe by DOI or id, cap at `TARGET_PAPER_COUNT` (10). `MIN_SPRINGER_BEFORE_NIH_FILL` is deprecated. NIH is searched on every run.
5. `readPaperExcerpts` in `src/app/api/discover/agent.ts`. Scholar snippets are dropped. A paper that fails `canSendToAI` sends only its abstract (`selectAbstractContext`, `excerptKind: "abstract"`) and never gets a quote or `licenseUrl`. Quote text uses `evaluateQuoteEligibility` (`src/app/lib/quote-eligibility.ts`), always in strict mode. `shouldDropForOaConflict` can drop a paper. Unpaywall does not fill a null home license.
6. `extractPaperFindings` in `src/app/api/discover/analyze.ts`. A failed extraction becomes `fallbackPaperExtraction`. The supporting excerpt comes only from `quoteExcerpt`. Each key finding also asks for the one sentence of the excerpt that supports it; `verifiedPaperEvidence` (`src/app/lib/paper-evidence.ts`) keeps it as `evidence` (`E{paper}.{n}`) only when it is word for word in the excerpt and at most 300 characters. Every item gets an `anchor` (a fingerprint: hash and length of the folded sentence, no text). The same step asks for `methodsQuote`, the paper's own sentence saying how the study was done; verified the same way, it is stored as `methodsEvidence` and "Show method" opens there (`methodFocusHref`). Without it, "Show method" opens the start of the paper's Methods section, never the model's `methods` paraphrase. The sentence text (`quote`) is stored only when the paper has a `quoteExcerpt` (quote-eligible body).
7. `synthesizeOpportunityReport` in `src/app/api/discover/synthesize.ts`. Each gap may carry `registryTerms` (AND-groups, sanitized in `src/app/lib/gap-activity.ts`). The writer cites evidence ids (`[E3.2]`); `attachCitationEvidence` rewrites them to `[Paper 3]` in every field and stores `sections.citationEvidence` (per field, the evidence id of each chip, in chip order, via `src/app/lib/cited-text.ts`). A chip opens its paper at that sentence: the stored `quote`, or for a paper we can't quote, the sentence `findAnchoredSentence` finds in the loaded paper by its anchor (reader links carry `?anchor=hash.length`). Without an id the client matches the chip's clause to the paper's evidence (`citedEvidence`), else falls back to the supporting excerpt.
8. `attachGapActivity` in `src/app/api/discover/gap-activity.ts`. For up to 4 gaps with terms: NIH RePORTER grants (last 3 fiscal years, requests spaced 1.1 s) and active ClinicalTrials.gov studies. Model-supplied `activity` is always stripped. Failures become `status: "unavailable"`; the step never throws. Grants store no PI or institution because they render on public briefs. UI copy must not call a gap "unfunded": zero matches is not proof of absence.
9. `attachClaimLedger` in `src/app/api/discover/claim-ledger.ts`.

If the first retrieval is empty, the agent may apply one NIH spelling suggestion (`src/app/api/discover/discovery-query.ts`) and retrieve again.

The route then runs `src/app/api/discover/founder-diligence.ts` beside the literature run and merges `src/app/lib/founder-report.ts` into `report.founder` and the markdown `brief`. That merge stores `report` as `{ sections, founder }`. The public brief rebuilds the ledger. See [claim-ledger.md](claim-ledger.md).

Provider cache: namespace `discovery-v8-evidence-anchors-{legacy|strict}` (one per `CONTENT_ACCESS_MODE`), 24 hours, keyed by the normalized question, in `src/app/lib/provider-cache.ts`. Quota is taken before that lookup.

Tests: `src/app/api/discover/agent.test.ts`, `src/app/api/discover/route-gates.test.ts`.

## Leave alone

- Do not reconstruct this sequence from `DiscoverClient.tsx`.
- Do not send Scholar snippets to the model, and do not treat SerpApi as a full-text home.
- Do not treat Unpaywall as enough to run Discover.
- Do not fold founder diligence into `runDiscoverAgent`.
- Do not persist article bodies. Cards store ids, metadata, and licensed excerpts.
