# Shareable brief

A shareable brief is a public `/brief/{slug}` page. Anyone with the link can read the synthesis. No account is required to view. Creating the slug requires a signed-in user.

## Sub-features

- `brief-discover-share` copies a topic-synthesis link from Discover **Share synthesis**.
- `brief-discover-public` opens `/brief/{slug}` logged out and shows **Topic Synthesis**, the question as `h1`, and **Papers behind this synthesis**.
- `brief-paper-generate` opens **Share summary** on a licensed paper and runs **Generate summary**.
- `brief-paper-copy` copies the paper link with **Copy share link**.
- `brief-paper-public` opens that slug logged out and shows **Paper Summary** plus **Open this paper**.
- `brief-invalid` visits `/brief/x` and gets a 404.

## How to get to it (user POV)

- On a signed-in Discover report, choose **Share synthesis**. The clipboard gets `{origin}/brief/{slug}`.
- On a signed-in paper reader, choose **Share summary**, then **Generate summary** or **Copy share link**.
- Open a slug someone already shared.
- Choose **Try Discover** or **Open this paper** from the brief footer.

## Driving it with the browser

Preconditions:

- Doctor passed.
- For create paths, you are signed in (`EM_VERIFY_EXPECT_AUTH=1` doctor) with remaining quota. Discover share needs a saved discovery id. Paper summary consumes one `chat` quota and requires `access.canSendToAI`.
- For view paths, you have a slug from this run or a known test slug. Do not invent slugs.
- Production POST is forbidden. Public GET of an existing slug is allowed.

- **Invalid slug.** Open `/brief/x`. The app 404s. `scripts/doctor` already checks this.
- **Discover share.** After a signed-in Discover pass, click **Share synthesis**. The button reads **Sharing…**, then **Link copied!** (or **Share failed**). Read the clipboard. It must match `{origin}/brief/{slug}` where slug matches `^[A-Za-z0-9_-]{10,24}$`.
- **API fallback for Discover share.** `POST /api/discover/share` with `{"id":"<mongoObjectId>"}`, cookie `auth_token`, and matching `Origin`. Expect `{ "slug": "..." }`. 401 without a cookie. 404 if the id is not this user's.
- **Public topic brief.** Open the slug in a fresh profile (no cookie). Eyebrow **Topic Synthesis**. `h1` equals the Discover question. Section **Papers behind this synthesis** lists the same titles. Disclaimer includes **not medical advice**. Primary button **Try Discover** goes to `/discover`.
- **Paper summary.** On a loaded paper with **Share summary** visible, click it. Dialog `aria-label="Paper summary"`, eyebrow **Paper Summary**, title is the paper title. If empty, click **Generate summary** and wait for markdown. Then **Copy share link**.
- **API fallback for paper brief.** `GET /api/brief?database=nih&paperId={id}&idName=pmcid` (auth). `POST /api/brief` with `{ "database", "paperId", "idName" }`, auth, and `Origin`. Expect `{ brief: { brief, slug, updatedAt } }`. 403 when license blocks AI send.
- **Public paper brief.** Open that slug logged out. Eyebrow **Paper Summary**. Primary button **Open this paper** goes to `chatPath` from `buildPaperPath`.
- **Proof.** Save the share click screenshot (**Link copied!** or **Copy share link**), the clipboard or JSON slug, and a logged-out screenshot of `/brief/{slug}` that shows the question or paper title.

## Gotchas

- Share APIs are `withAuth`. Guest curl will 401. That is correct.
- Discover share only accepts a Mongo ObjectId. Guest ids `guest-*` and empty ids `empty-*` cannot share.
- Regenerating a paper summary spends another `chat` quota. Prefer the existing brief when `GET /api/brief` already returns one.
- Invalid slugs 404 before Mongo. Missing valid slugs 404 after Mongo. A local 500 on a well-formed slug usually means `MONGODB_URI` is unset, not a brief bug.
- The public page is the proof. Clipboard success alone is not.
