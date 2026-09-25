# Claim ledger and share link

Two checks. They are not the same gate.

**Share link.** `POST` `src/app/api/discover/share/route.ts` (`withAuth`) needs a Mongo id for a `SavedDiscovery` owned by the caller. It sets `shareSlug` through `src/app/lib/share-slug.ts` when the field is empty. Claim-excerpt completeness does not block this. Tests: `src/app/api/discover/share/route.test.ts` (a slug is created when licenses or excerpts are missing) and `src/app/api/discover/share/route-gates.test.ts` (origin and id).

**Ledger.** `buildClaimLedger` and `attachClaimLedger` in `src/app/api/discover/claim-ledger.ts` turn existing report sections into rows: gaps, problems (through `gapRefs`), and ventures. `isClaimLedgerRowComplete` requires a non-empty `quote`, a citation (`doi`, `paperId`, or `href`), and `isCommercialFriendlyLicenseUri`. Scholar rows keep an empty quote and no license. `evaluateShareGate` and `shareLockDetail` score that completeness. The share route does not call them.

**Public page.** `src/app/lib/shared-brief.ts` serves `/brief/[slug]` from `src/app/brief/[slug]/page.tsx`. A discovery brief rebuilds the ledger on read with `attachClaimLedger`, using stored sections, papers, and extractions. After the route merge, saved `report` is `{ sections, founder }` and may omit `claimLedger`.

Which sentences may be quoted is decided earlier. See [content-access.md](content-access.md).

## Leave alone

- Do not call `evaluateShareGate` from `POST /api/discover/share`.
- Do not delete `evaluateShareGate`. It is the completeness score, and its tests stay.
- Do not rewrite the opportunity report to invent rows. Reshape gaps, problems, and ventures.
- Do not add a second ledger builder. The read path already rebuilds it.
- Do not let Unpaywall set `licenseUrl` when the home license is null.
