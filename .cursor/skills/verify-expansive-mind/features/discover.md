# Discover

Discover takes a biomedical question, searches Springer Nature, NIH PubMed Central, and (Pro) Google Scholar, and returns a cited opportunity report. This is the launch path. A pass here is a report the user can read and share, not a search list.

## Sub-features

- `discover-open` reaches `/discover` from nav and from a direct URL.
- `discover-ask` submits `#discover-question` with **Run discovery**.
- `discover-progress` shows the live steps while the request runs (often 1–2 minutes).
- `discover-report` renders **Topic synthesis** with **Claim ledger**, **State of the science**, and **Gaps in the science**, or the markdown fallback **Evidence synthesis**.
- `discover-claim-ledger` lists every gap, problem, and venture claim as a row with a source excerpt. A complete row click opens the cited paper preview.
- `discover-empty` shows **No papers found** / **Nothing I can synthesize yet** when the agent returns `noResults`.
- `discover-quota` shows the guest remaining count or the locked **Continue discovering with Researcher Pro** control.
- `discover-share-affordance` shows **Share synthesis** when signed in with a saved Mongo id. The button stays disabled, with `#discover-share-lock`, until the claim ledger is complete.

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

- **Open Discover.** Go to `/discover`. The `h1` reads **Discover across papers**. The eyebrow reads **Cross-database research agent**.
- **Focus the question.** Find `#discover-question`. The label is **Research question**. Placeholder example mentions GLP-1 and type 2 diabetes.
- **Enter a question.** Fill `#discover-question` with a real biomedical question. **Run discovery** enables.
- **Submit.** Click **Run discovery**. The button reads **Working…**. An `aria-live` region appears with **Your answer is taking shape** and steps **Expanding your question**, **Searching literature**, **Reading papers**, **Extracting findings**, **Analyzing gaps**, **Composing report**.
- **Read the report.** Wait until the live region is gone and the header **Topic synthesis** appears. Structured reports use title **Gaps, problems, and potential**, kicker **What the science leaves open**, and cards **Claim ledger**, **State of the science**, plus **Gaps in the science**. A ledger row or citation chip opens the cited paper preview (`id="discover-paper-{index}"`, 1-based). The question is repeated in the **Question** blockquote.
- **Confirm save state.** Signed-in badge **Saved** and a link **View Research Library**. Guest badge **Preview complete** and **Create an account**.
- **Share affordance.** Signed-in with a 24-char hex `id`: **Share synthesis** is visible. It is enabled only when `#claim-ledger` shows every row sourced. Incomplete: the button is disabled and `#discover-share-lock` contains **Share is locked until every claim has a source excerpt** or **Share stays locked until this brief has sourced claims**. Guest: the button is absent.
- **Empty state.** If the body is **No papers found**, that is `discover-empty`, not a crash. Quota refunds on `noResults`.
- **Quota wall.** Guest exhausted: **Continue discovering with Researcher Pro**. API `code` `QUOTA_EXCEEDED` or `DAILY_CAP_REACHED`. Record and stop. Do not retry against production.
- **API fallback.** `POST /api/discover` with `{"question":"..."}` and `Origin: $EM_VERIFY_BASE_URL`. Expect JSON `question`, `papers[]` with `href` like `/paperchatbot/{database}/{id}`, and `report` or `brief`. Guest `id` starts with `guest-`. Signed-in `id` is a Mongo ObjectId.
- **Proof.** Screenshot the report header and one gap card. Save HTML or an ARIA snapshot that includes the question text and **State of the science** or **Evidence synthesis**. Write the JSON `id` and first paper `href` into `$EVIDENCE_DIR/discover.json` with secrets removed.

## Gotchas

- Deep analysis can take a minute or two. Wait for the report header, not a fixed sleep.
- Guest Discover is 1 lifetime run per network. A second guest run is a quota wall, not a regress.
- **Share synthesis** requires a signed-in saved discovery whose claim ledger is complete. Guest preview cannot share. A visible disabled button plus `#discover-share-lock` is the incomplete-ledger state, not a regress.
- `POST` without a matching `Origin` returns 403 `Invalid origin.`
- A leftover guest report can stay on screen while a follow-up runs. Assert the new **Question** text, not the first report you saw.
- Do not open `DiscoverClient.tsx` to "verify" by reading code. Drive the page.
