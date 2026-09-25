# Paper reader

The paper reader opens a single cited source at `/paperchatbot/{database}/{paperId}`. The user reads licensed text, highlights, chats, and can generate a shareable paper summary. Reach it from a Discover report whenever you can. A naked id you invented is a weaker proof.

## Sub-features

- `reader-from-report` follows a Discover paper `href` (`buildPaperPath`).
- `reader-load` shows the paper `h1` after `/api/paper` returns.
- `reader-notice` handles correction or erratum interstitial (**Read this notice** / **Open full article**).
- `reader-tools` shows signed-in **Paper tools** (**Highlight**, **Share summary**) when `canSendToAI` or figure analysis is allowed.
- `reader-chat` sends a question from **Ask this paper…**.
- `reader-restricted` shows the load or policy error when the paper cannot be sent to AI.

## How to get to it (user POV)

- Click a paper title or cite chip on a Discover report (`id="discover-paper-{n}"` or the cite control).
- Click a title under **Papers behind this synthesis** on `/brief/{slug}`.
- Click **Open this paper** on a paper-kind brief.
- Open `/paperchatbot/nih/{pmcid}`, `/paperchatbot/springer/{doi}`, or `/paperchatbot/scholar/{cluster_id}` directly. Add `?idName=` only when it is not the source default (`pmcid`, `doi`, `cluster_id`).

## Driving it with the browser

Preconditions:

- Doctor passed.
- You have a real `href` from Discover `papers[]` or from a public brief. Do not invent a PMCID.
- Paper GET needs provider keys locally. Guest paper reads are rate-limited (6/min) and have a daily cap.
- Chat and **Share summary** need a signed-in user and `access.canSendToAI`.

- **Open from the report.** On a finished Discover report, click the first paper control. URL matches `/paperchatbot/{nih|springer|scholar}/...`.
- **Wait for load.** Overlay **Preparing this paper…** clears. The `h1` equals the card title (or a close metadata variant). **Back to research** is visible.
- **Notice interstitial.** If **This page is a correction notice** (or erratum / retraction / expression of concern) appears, that is `reader-notice`. Click **Read this notice** to stay, or **Open full article** to follow the related PMC. Do not treat the interstitial as a load failure.
- **Load error.** Visible `.loadError` text such as **Unable to load this paper.** Record status from `GET /api/paper?database=&paperId=&idName=`. Guest daily cap uses `code` `DAILY_CAP_REACHED`.
- **Tools.** Signed-in and licensed: toolbar `aria-label="Paper tools"` with **Highlight** (`aria-pressed`) and **Share summary** (only if `canSendToAI`). Guest: toolbar absent. Reading the `h1` is still a valid `reader-load` pass.
- **Chat.** Placeholder **Ask this paper…**. Fill a short methods or findings question. Click the button `aria-label="Send message"`. Wait until `aria-label="Assistant is thinking"` is gone. The reply is visible and should cite the paper. Guest chat quota is 0, so this path is signed-in only.
- **Share summary.** Same controls as [shareable-brief.md](./shareable-brief.md) `brief-paper-generate`. Prove it there if you open the dialog from the reader.
- **API fallback.** `GET /api/paper?database=nih&paperId={id}&idName=pmcid`. Expect `{ paper: { title, access, ... }, authenticated, messages }`. Missing params are the doctor 400.
- **Proof.** Screenshot the `h1` and **Back to research**. Save the URL and the Discover `href` you followed. If you chatted, capture the sent question and the assistant reply, not only the empty composer.

## Gotchas

- `database` is `nih` | `springer` | `scholar`. Search UI may say Nature. The path is still `springer`.
- PMC ids in the path are digits. `buildPaperPath` encodes DOI slashes as multiple segments.
- Full text and figures follow `content-access-policy`. `CONTENT_ACCESS_MODE=strict` plus a non-CC license hides chat and **Share summary** even for Pro.
- Guest chat quota is 0. A guest **Send message** path that "does nothing" is entitlements, not a dead button.
- Figure chat is out of scope for the first map. Do not call reader done from a figure explain click alone.
