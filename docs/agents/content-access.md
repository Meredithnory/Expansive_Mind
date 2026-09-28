# Content access and licenses

One normalizer: `normalizeLicense` and `evaluateContentAccess` in `src/app/lib/content-access-policy.ts`. Commercial-friendly means `CC0`, `CC-BY`, `CC-BY-SA`, and `CC-BY-ND` (`COMMERCIAL_FRIENDLY_LICENSES`). NC text and unrecognized text become `OTHER` or `UNKNOWN`.

`getContentAccessMode`: `CONTENT_ACCESS_MODE=strict` is strict. Any other value, including unset, is `legacy`. Legacy still sets `canDisplayFullText`, `canSendToAI`, `canPersistContent`, and `canUseImages` when the license is not commercial-friendly (`legacy_live_access`). Strict requires a commercial-friendly license and no conflict. Do not change the env value.

Figures: `canUseFigureImage`. A figure that declares its own permissions must itself be commercial-friendly. Otherwise it inherits the article flag.

The quote gate is strict even when the mode is legacy. `evaluateQuoteEligibility` in `src/app/lib/quote-eligibility.ts` blocks Scholar snippets, abstract-only bodies, a null home license, a non-commercial-friendly license, and `license_conflict`. Missing, empty, unrecognized, and undetermined license text fail closed: the verbatim passage is omitted. `quoteLicenseFromHome` ignores its OA argument. What the code logs and how a shown quote carries a title and link: [quote-compliance.md](quote-compliance.md).

Unpaywall (`src/app/api/research/adapters/unpaywall.ts`) and `oaConflictsWithHome` in `src/app/api/research/oa.ts`: a commercial-friendly home plus an OA license of `OTHER` drops the paper. An unknown OA record is not a conflict. An OA CC license does not upgrade an unknown home.

Creating a share link is not this gate. See [claim-ledger.md](claim-ledger.md).

## Unlicensed papers in strict mode

Strict mode keeps an unlicensed body off our servers, but reading still works:

- `getPaperDetails` returns metadata, the abstract, and `browserFullText` (PMCID + figure URLs, never text). The reader's browser loads the body from NIH E-utilities, falling back to Europe PMC (`src/app/lib/browser-paper.ts`). Nothing it loads is sent back. Figures are `displayOnly`, with no analysis.
- Chat on those papers uses the abstract only (`paperChatMode` in `src/app/lib/chat-access.ts`). Passages and screenshots from them are not sent to the model. Highlights and share links stay off because `canPersistContent` is false.
- Discover uses their abstracts (see [discover-pipeline.md](discover-pipeline.md)).
- The paper cache namespace carries the mode (`paperDetailCacheNamespace`), so switching modes never serves the other mode's cached bodies.

## Leave alone

- Do not add a second license allowlist.
- Do not let an OA locator authorize a quote or a ledger `licenseUrl`.
- Do not send an unlicensed body to the model or store it, including text the browser loaded.
- Do not send a full paper to the model. Excerpts go through `selectPaperContext` and `selectQuotableExcerpt` in `src/app/lib/paper-context.ts`.
- Do not persist article XML or HTML.
