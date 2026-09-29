# Discover

Discover takes a biomedical question, searches Springer Nature, NIH PubMed Central, and (when keys are set) Google Scholar plus OpenAlex and Europe PMC, and returns a cited opportunity report. This is the launch path. A pass here is a report the user can read and share, not a search list.

## Sub-features

- `discover-open` reaches `/discover` from nav and from a direct URL.
- `discover-ask` submits `#discover-question` with **Run discovery**.
- `discover-progress` shows the live steps while the request runs (often 1–2 minutes).
- `discover-report` renders the report tabs **State of the science**, **Gaps · N**, **Papers · N**, **Provenance**, and **Claim ledger**, or the markdown fallback under **State of the science**.
- `discover-claim-ledger` lists each gap, problem, and venture claim once (a repeated claim folds into the first), with every cited paper under it: a licensed quote when allowed, else a **Paper N · title** pill, and **Scope:** when known. A passage already quoted above shows **Same passage as above**. A **Paper N** click opens the paper panel.
- `discover-empty` shows **No papers found** / **Nothing I can synthesize yet** when the agent returns `noResults`.
- `discover-quota` shows the guest remaining count or the locked **Continue discovering with Researcher Pro** control.
- `discover-share-affordance` shows **Share brief** when signed in with a saved Mongo id. The button is enabled; claim-excerpt completeness does not gate it.

## How to get to it (user POV)

- Open `/discover`.
- Open navigation (`Open navigation`) and choose **Discover**.
- After login, the app routes to `/discover`.
- Follow **Try Discover** on a topic-synthesis `/brief/{slug}` page.

## Driving it with the browser

Preconditions:

- Doctor passed on `$EM_VERIFY_BASE_URL`.
- Local full run has `.env.local` keys. Production POST is forbidden.
- Guest remaining Discover count is greater than 0, or you are signed in with remaining `discover` quota.
- Question text is 1–2000 characters.

- **Open Discover.** Go to `/discover`. The `h1` reads **What do you want to find out?** under the **Discovery | Search** tabs.
- **Focus the question.** Find `#discover-question`. The label is **Research question**. Placeholder example mentions GLP-1 and type 2 diabetes.
- **Enter a question.** Fill `#discover-question` with a real biomedical question. **Run discovery** enables.
- **Submit.** Click **Run discovery**. An `aria-live` region appears with **Discovery in progress**, the question, and steps **Turning your question into searches**, **Searching NIH PMC, Springer Nature, Europe PMC, Crossref**, **Picking the most relevant open-access papers**, **Reading and extracting findings, methods, limits**, **Writing your cited report**.
- **Read the report.** Wait until the live region is gone and the eyebrow **Your discovery** appears with the question as the `h1`. Reports open on **State of the science**, with tabs **Gaps · N** (the chosen gap large, **Paper N · open paper chat →**, **Start a project**), **Papers · N** (`id="discover-paper-{index}"`, 1-based), **Provenance** (`id="provenance-paper-{index}"`: source, PMCID, link, **Cited in**, quote status), and **Claim ledger**. A ledger row or citation chip opens the cited paper preview.
- **Confirm save state.** The report footnote ends **Saved to your library.** when signed in and **Preview only.** for a guest. The saved run is the lead card on `/savedpapers` (Syntheses tab).
- **Share affordance.** Signed-in with a 24-char hex `id`: **Share brief** is visible and opens **Share your brief**. Guest: the button is absent. There is no `#discover-share-lock`.
- **Empty state.** If the body is **No papers found**, that is `discover-empty`, not a crash. Quota refunds on `noResults`.
- **Quota wall.** Guest exhausted: **Continue discovering with Researcher Pro**. API `code` `QUOTA_EXCEEDED` or `DAILY_CAP_REACHED`. Record and stop. Do not retry against production.
- **API fallback.** `POST /api/discover` with `{"question":"..."}` and `Origin: $EM_VERIFY_BASE_URL`. Expect JSON `question`, `papers[]` with `href` like `/paperchatbot/{database}/{id}`, and `report` or `brief`. Guest `id` starts with `guest-`. Signed-in `id` is a Mongo ObjectId.
- **Proof.** Screenshot the report header and one gap card. Save HTML or an ARIA snapshot that includes the question text and the **Gaps** or **State of the science** tab. Write the JSON `id` and first paper `href` into `$EVIDENCE_DIR/discover.json` with secrets removed.

## Gotchas

- Deep analysis can take a minute or two. Wait for the report header, not a fixed sleep.
- Guest Discover is 1 lifetime run per network. A second guest run is a quota wall, not a regress.
- **Share brief** requires a signed-in saved discovery (Mongo ObjectId). Guest preview cannot share. Claim-excerpt completeness does not disable the button.
- `POST` without a matching `Origin` returns 403 `Invalid origin.`
- A leftover guest report can stay on screen while a follow-up runs. Assert the new **Question** text, not the first report you saw.
- Do not open `DiscoverClient.tsx` to "verify" by reading code. Drive the page.
