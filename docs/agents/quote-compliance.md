# Quote compliance

Engineering record of what the quote code does. This is not legal advice, and it does not say that a quote is legally safe.

## Cap

`selectQuotableExcerpt` in `src/app/lib/paper-context.ts` stops at 600 characters. `SUPPORTING_EXCERPT_CHAR_BUDGET` in `src/app/api/discover/analyze.ts` is also 600. The supporting excerpt is taken from `quoteExcerpt` only.

## License gate

`evaluateQuoteEligibility` in `src/app/lib/quote-eligibility.ts` runs in strict mode even when `CONTENT_ACCESS_MODE` is legacy. A quote is allowed only for a commercial-friendly home license: `CC0`, `CC-BY`, `CC-BY-SA`, or `CC-BY-ND`. Scholar snippets, abstract-only bodies, and `license_conflict` are blocked. `quoteLicenseFromHome` does not take an OA license.

## Fail closed

Missing, empty, unrecognized, and undetermined license text omit the verbatim passage the same way a known blocked license does. Undetermined text includes `unknown` and `we couldn't determine the license`. A commercial-friendly license URL still counts as a determined license. The allowlist is not wider than the four licenses above.

`buildClaimLedger` in `src/app/api/discover/claim-ledger.ts` copies an excerpt onto a row only when `visiblePaperQuote` accepts it. The paper preview uses the same check.

## Attribution

A shown quote includes the paper title and a resolvable link: the DOI when the app has one, otherwise the paper URL it already stores (`sourceUrl` or the in-app `href`). If the title or the link is missing, the quote is omitted. A citation elsewhere on the page is not a substitute for those two fields on the quote.

Surfaces: `src/app/discover/PaperPreviewDrawer.tsx`, `src/app/discover/ClaimLedgerView.tsx` (also the shared brief at `src/app/brief/[slug]/page.tsx`), and founder quotes in `src/app/discover/FounderReportView.tsx` plus `founderReportMarkdown` in `src/app/lib/founder-report.ts`. CC-BY attribution here is the title and the link on the quote. It is separate from any other citation on the page.

## Provenance log

When a paper is read for Discover, and again when a ledger is built, the server writes one `quote_decision` line. Fields: `paperId`, `licenseResult` (`allowed`, `fail-closed`, or `unknown`), `quoteOmitted`, `titlePresent`, `linkPresent`. The quote text is not logged.
