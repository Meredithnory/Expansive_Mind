# Founder diligence

Every Discovery question produces both the scientific report and founder diligence. No mode selection or second question is required. Geography, budget, customer, and development stage are optional context; omitted details remain unspecified instead of being guessed. The report compares venture hypotheses and covers eight diligence areas, with source excerpts and explicit missing evidence. The scientific report remains available in the same result.

## Additional literature indexes

The retrieval pipeline now also searches [Europe PMC](https://dev.europepmc.org/RestfulWebService) and [Crossref](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/), alongside Springer Nature, NIH PMC, and Google Scholar. Europe PMC is queried with up to two targeted queries. Crossref returns up to twelve journal-article DOIs, which are resolved through Europe PMC. Only exact DOI matches with PMC identifiers become candidates; unresolved metadata is not supplied as scientific evidence.

These are additional discovery indexes, not unrestricted new full-text hosts. This integration expands discovery into their indexed records that have PMC copies. The existing PMC loader checks access again before sending any paper text to synthesis. It still needs the existing `NCBI_EMAIL` configuration; no new paid key is needed for these indexes. `CROSSREF_MAILTO` is optional for Crossref's polite pool. Known retracted records and preprints are excluded from the added adapters. Papers found through multiple indexes are deduplicated by DOI and host identifier, and their `indexedBy` provenance is retained on paper cards. Index coverage in the report distinguishes records returned, matched PMC candidates, and initial eligibility. A completed search is not a claim of exhaustive coverage or a guarantee that all matches were read.

Searches are bounded and have a twelve-second request timeout. Provider errors are recorded as partial or unavailable coverage, while successful providers can still supply the report. Literature cache namespace v5 prevents earlier three-index results from hiding the new retrieval path. Commercial analysis continues to be generated separately for each request.

## Evidence and limits

- Commercial discovery uses the existing `SERPAPI_KEY` with the Google search engine. See the [search API](https://serpapi.com/search-api) and [organic result format](https://serpapi.com/organic-results).
- Four searches and at most eight primary HTML pages are retrieved per founder run. Fetches are restricted to US government, registry, and filing domains. Redirect destinations are checked, requests are bounded, and search snippets are not used as evidence.
- Publication dates are not inferred from retrieval dates. PDF and dynamically rendered documents are not read. Company websites and private market databases are not covered by this version. Failed retrieval is shown as missing coverage.
- Composition uses the existing private completion wrapper and usage accounting. The server supplies the source register; model output cannot replace it. Findings without a matching quotation and source ID are discarded. This checks text provenance, not semantic entailment or independent truth. Model analysis remains explicitly labeled inference and needs review.
- Patent clearance, regulatory approval, currently available financing, commercial viability, and an investment recommendation are not established by the report. It cannot promise complete truth or exhaustive diligence.

## Venture ranking (rubric v1)

Each option includes source-linked analyst ratings of 1–5 for customer demand (25%), technical feasibility (20%), reachable revenue opportunity (15%), differentiation (15%), capital efficiency (15%), and execution path (10%). Rating 1 maps to zero points, 3 to 50, and 5 to 100. The code calculates weighted points divided by assessed weight; model-supplied totals and rankings are ignored. Every accepted rating requires a rationale and a matching quotation from the trusted source register. This checks provenance, not correctness of the judgment.

Missing, invalid, or unsupported ratings remain unknown. Evidence coverage is the total assessed weight, not confidence or success probability. Score bounds run from earned points to earned points plus missing weight; these are missing-data bounds, not statistical intervals. Rankings require at least 70% coverage plus assessments of demand, technical feasibility, and capital. Ties share a rank. A preferred option is named only when all alternatives qualify, its score is at least 60, no critical criterion is rated 1, and its lower bound exceeds every competitor's upper bound. These weights and thresholds are transparent product heuristics, not validated predictors of venture returns.

Rankings prioritize the next venture to validate, with the score breakdown, source excerpts, and validation milestone alongside each option. They are included in saved/restored reports and Markdown downloads. Legacy reports without assessments remain unscored; generate a new report for ratings.

## Financial scenarios

Downside, base, and upside columns start blank. Entries are user assumptions; the report does not automatically invent forecast inputs from scientific evidence. Users should record URLs, dates, quotes, customer validation, and vendor budgets in the assumptions field.

- Annual revenue = paying customers × annual revenue per customer.
- Annual operating profit before interest and tax = revenue × gross margin − annual operating expense.
- Additional funding to a named milestone = max(0, (monthly net cash burn × months + additional one-time costs) × (1 + contingency) − cash available).

These calculations do not establish market size, valuation, financing availability, investor returns, or the probability of technical or commercial success. Costs included in monthly burn must not also be counted as additional one-time costs. Gross margin and contingency are entered as percentages. All currency inputs are USD; users must establish consistent dates and any exchange-rate assumptions themselves.

Reports are saved through the existing discovery storage and included in shared Markdown. Scenario edits are in-memory and are included in the explicit Markdown download, not automatically in saved or publicly shared reports. Do not treat the share link as a saved financial model.

## Operations and verification

The discovery route allows up to 300 seconds; deployment must support that duration. Literature caching remains separate from fresh commercial retrieval. Every discovery request uses the existing discovery quota and includes commercial-search and model usage. A missing search key or failed synthesis produces a visibly incomplete report, without a made-up financial conclusion.

Targeted tests cover source matching, unsafe URLs and redirects, model source-register substitution, missing providers, synthesis failure, guest restoration, financial arithmetic, the unified request path, DOI resolution, index failure handling, and cross-index deduplication. UI calculations were checked using a synthetic local fixture, including the mobile layout. A live single-question CAR-T example completed with ten papers and founder analysis; Europe PMC returned 26 unique PMC matches, Crossref resolved five, and a Crossref-discovered paper entered synthesis. This verifies the integration, not the scientific or investment correctness of the generated claims.

Before describing this as investment-grade diligence, expand source coverage, add claim-to-source entailment and date review, validate on real venture case studies with domain experts, and support sourced financial inputs and persisted per-venture models. Those are substantive remaining capabilities, not guarantees supplied by citation matching.

Discovery opens on the Science report tab. The Opportunity report is an optional tab of the same saved discovery; switching tabs preserves mounted report state and does not run another analysis. Optional venture context is available at the end of the opportunity tab, where generating a refined report uses another Discovery run. New questions do not inherit that context.


Report visuals show actual extraction counts, existing rubric scores, and manually entered financial scenario outputs. Unknown quantities stay unknown. Venture decisions remain validation priorities, not calibrated probabilities or investment verdicts. Each criterion expands to its rationale and matching source excerpt.

The authenticated `/api/discover/chat` assistant loads only discoveries owned by the requester, enforces the chat quota and rate limit, and uses saved supporting excerpts or up to three selected papers retrieved under the existing content access policy. Commercial source text may also be consulted. It does not run independent paper agents or a live web search. Factual answer items require a server-matched quote and server-owned citation URL; uncited model narrative is withheld. Quote matching establishes provenance, not semantic correctness. Personal context and conversation are currently held in client state for the open report and sent with each question; no cross-report profile is stored. Suggested searches populate the research question input and require the user to run them.


Discovery now exposes the existing paper chatbot through a bottom-right popup after a report loads. It reuses Chatbox, /api/paper, and /api/aichat, including paper-scoped saved messages and citation cards. The previous inline report assistant is no longer rendered. Selected conversations stay mounted when minimized or switched. The current discovery question and optional user-stated goal are passed as non-evidence context; the assistant adapts to replies without inferring personal traits. Goal text is not stored as a cross-report profile. Full-paper citation links open separately so discovery remains available.
