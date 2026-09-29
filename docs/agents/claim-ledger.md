# Claim ledger and share link

Two checks. They are not the same gate.

**Share link.** `POST` `src/app/api/discover/share/route.ts` (`withAuth`) needs a Mongo id for a `SavedDiscovery` owned by the caller. It sets `shareSlug` through `src/app/lib/share-slug.ts` when the field is empty. Claim-excerpt completeness does not block this. Tests: `src/app/api/discover/share/route.test.ts` (a slug is created when licenses or excerpts are missing) and `src/app/api/discover/share/route-gates.test.ts` (origin and id).

**Ledger.** `buildClaimLedger` and `attachClaimLedger` in `src/app/api/discover/claim-ledger.ts` turn existing report sections into rows: gaps, problems (through `gapRefs`), and ventures. There is one row per claim, and its cited papers are `sources`. A claim whose normalized text repeats an earlier row (a problem titled like its gap) merges into that row. Each source quotes the sentence the claim cited through `citationEvidence` and the extraction's `evidence`, else the paper's `supportingExcerpt`, through the same license gate. `scope` is the paper's grounded `population`, shortened by `scopeLabel`. `isClaimLedgerSourceComplete` requires a non-empty `quote`, a citation (`doi`, `paperId`, or `href`), and `isCommercialFriendlyLicenseUri`. A row is complete when any source is. Scholar sources keep an empty quote and no license. `evaluateShareGate` and `shareLockDetail` score that completeness. The share route does not call them. `ClaimLedgerView` prints each passage once. A later claim citing the same passage shows **Same passage as above**.

**Public page.** `src/app/lib/shared-brief.ts` serves `/brief/[slug]` from `src/app/brief/[slug]/page.tsx`. A discovery brief rebuilds the ledger on read with `attachClaimLedger`, using stored sections, papers, and extractions. Each entry in **Papers behind this synthesis** carries the same `scope`, so `[Paper N]` in older briefs still shows what that paper studied. After the route merge, saved `report` is `{ sections, founder }` and may omit `claimLedger`.

Which sentences may be quoted is decided earlier. See [content-access.md](content-access.md). A ledger row keeps a quote only when the home license is commercial-friendly and the row has a paper title plus a DOI or paper URL. `ClaimLedgerView` renders that title and link with the passage. The shared brief uses the same view. Missing title, missing link, or an unknown license omits the passage. Record: [quote-compliance.md](quote-compliance.md).

## Leave alone

- Do not call `evaluateShareGate` from `POST /api/discover/share`.
- Do not delete `evaluateShareGate`. It is the completeness score, and its tests stay.
- Do not rewrite the opportunity report to invent rows. Reshape gaps, problems, and ventures.
- Do not add a second ledger builder. The read path already rebuilds it.
- Do not let Unpaywall set `licenseUrl` when the home license is null.
- Do not go back to one row per (claim, paper). A claim with three citations is one row with three sources.
- The synthesis prompt requires a number to name the population it was measured in. Keep that rule. The ledger `scope` label backs it up for briefs written before it.
