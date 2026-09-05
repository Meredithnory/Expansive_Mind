---
name: verify-expansive-mind
description: Drive Expansive Mind the way a user does on the web UI (expansivemind.ai or local npm run dev). Use before claiming Discover, shareable brief, or paper-reader work is done, and after any change to those routes.
---

# Verify Expansive Mind

Launch the real app. Exercise Discover → report → share/brief the way a researcher does. Capture evidence. Do not call it done from `npm test` alone.

Launch outcome (locked): fuzzy question → cited opportunity report → shareable brief. Search, reader chat, and projects serve that path. They do not replace it.

Read [features/README.md](features/README.md) before you drive. Cover every entry point the feature file lists, or report the unmet precondition. One convenient path is not coverage.

Keep the map honest with `/maintain-verification-skill` after product changes.

## Launch

Primary surface: the Next.js App Router UI.

Local command:

```bash
export RUN_ID="$(date +%Y%m%dT%H%M%S)-$$"
export EVIDENCE_DIR="/tmp/expansive-mind-verify/${RUN_ID}"
export EM_VERIFY_PORT="${EM_VERIFY_PORT:-3000}"
export EM_VERIFY_BASE_URL="http://127.0.0.1:${EM_VERIFY_PORT}"
mkdir -p "$EVIDENCE_DIR"
PORT="$EM_VERIFY_PORT" npm run dev
```

`npm run dev` is `next dev --turbopack`. Ready when stdout contains `Ready` and `scripts/doctor` exits 0 against `$EM_VERIFY_BASE_URL`.

Copy env from `.env.example` into a gitignored `.env.local`. Discover, paper load, and brief generation need Mongo plus provider keys (`MONGODB_URI`, `API_KEY`, `SPRINGER_API_KEY`, `AI_API_KEY`, `JWT_SECRET`). Doctor and the Discover page HTML do not.

Production read-only target: `https://expansivemind.ai`. Set `EM_VERIFY_BASE_URL` to that origin for doctor and public GETs only. Never `POST /api/discover`, `POST /api/discover/share`, or `POST /api/brief` against production.

Teardown is in Cleanup. Evidence stays in `$EVIDENCE_DIR`.

## Doctor

Run this first, and again after any failed drive:

```bash
.cursor/skills/verify-expansive-mind/scripts/doctor
```

Override the origin with `EM_VERIFY_BASE_URL` or a single argument. Default is `http://127.0.0.1:3000`.

Anonymous doctor expects:

- `GET /discover` 200, body contains `Discover across papers` and `id="discover-question"`
- `GET /api/session` 401 and `Please login`
- `GET /api/paper` 400 and `A valid paper reference is required.`
- `GET /brief/x` 404 (`x` fails `isValidShareSlug`)

A leftover `auth_token` makes `/api/session` return 200. That is not a healthy anonymous instance. Sign out or use a fresh browser profile. Set `EM_VERIFY_EXPECT_AUTH=1` only when you intend to drive a signed-in session.

Do not drive an instance doctor has not passed since the last surprise.

## Drive

Prefer the browser (Cursor browser or Playwright) on `$EM_VERIFY_BASE_URL`. Use the labels and ids in the feature map. Do not click by coordinates.

Stable handles (from source, not guesses):

- Nav: open `#main-navigation` via the button `Open navigation`, then the `Discover` link.
- Discover question: `#discover-question` (`<textarea>`, label **Research question** or **Ask another research question**).
- Discover submit: button **Run discovery** (disabled while empty or **Working…**).
- Discover running: `aria-live="polite"` region, copy **Your answer is taking shape**, steps **Expanding your question** through **Composing report**.
- Discover report: **Topic synthesis**, then **Gaps, problems, and potential** (structured) or **Evidence synthesis**. Cards **State of the science** and **Gaps in the science**. Paper nodes `id="discover-paper-{index}"`.
- Discover share: **Share synthesis** (signed-in only, `result.id` is a 24-char hex ObjectId). Success label **Link copied!**.
- Brief page: `/brief/{slug}`. Eyebrow **Topic Synthesis** or **Paper Summary**. Heading is the question or paper title. Source list heading **Papers behind this synthesis**. Primary CTA **Try Discover** or **Open this paper**.
- Paper reader: `/paperchatbot/{nih|springer|scholar}/{id}` from `buildPaperPath`. Title is an `h1`. Back control **Back to research**. Signed-in toolbar `aria-label="Paper tools"`: **Highlight**, **Share summary**. Summary dialog `aria-label="Paper summary"`, generate **Generate summary**, copy **Copy share link**. Chat placeholder **Ask this paper…**, send `aria-label="Send message"`.
- Login: `/login`, heading **Login**, email `name="email"`, password `name="password"`, submit **Login**.

API fallback when the UI is blocked (missing keys, no browser). Send `Origin` matching the request origin on every mutating POST (`hasValidMutationOrigin`).

```bash
curl -sS -X POST "$EM_VERIFY_BASE_URL/api/discover" \
  -H "Content-Type: application/json" \
  -H "Origin: $EM_VERIFY_BASE_URL" \
  -d '{"question":"How does GLP-1 receptor agonism affect cardiovascular outcomes in type 2 diabetes?"}'
```

Guest share is impossible. `POST /api/discover/share` and `POST /api/brief` use `withAuth`. Cookie `auth_token` is required. Guest `result.id` is `guest-{timestamp}`, not a Mongo id, so **Share synthesis** stays hidden.

Do not POST Discover or brief as a substitute for the UI path when the browser is available. Curl is the fallback, not the proof of record.

Recipes: [features/discover.md](features/discover.md), [features/shareable-brief.md](features/shareable-brief.md), [features/paper-reader.md](features/paper-reader.md).

## Evidence

Store proof under `$EVIDENCE_DIR` (`/tmp/expansive-mind-verify/<run-id>/`). Cleanup must not delete this directory.

Proof standards:

- Drive the user path in the feature map. Do not seed reports through test-only hooks. There are none.
- Capture the action and the resulting state. A final screenshot without the question, progress, or share click is incomplete.
- For a mutation, add a second read. After share, open `/brief/{slug}` in a fresh session (no cookie) and confirm the question or title.
- UI proof: screenshot plus an accessibility snapshot or HTML excerpt that includes the heading and the control you used.
- API proof: request line, status, and a redacted body (`id`, `question`, `report`/`brief` present, paper `href`s). Never write cookies, JWT, or provider keys into evidence.
- Quota or license blocks are `verified-unreachable` only when you record the status, `code` (`QUOTA_EXCEEDED`, `DAILY_CAP_REACHED`), and the visible copy. Do not treat a quota wall as a product pass.

Mocks are allowed only at production boundaries that already isolate providers (Vitest). They do not count as this skill's proof.

## Cleanup

Kill only the `npm run dev` / `next` process this run started. Record its pid at `$EVIDENCE_DIR/dev.pid` when you launch. `kill` that pid. Do not `pkill -f next`.

Leave `$EVIDENCE_DIR` in place. Remove only in-app scratch you created (a throwaway discovery question left in the textarea is enough to clear). Do not delete saved library rows on a shared account.

Two local `next dev` processes can use different `PORT`s. They still share Mongo and guest Discover quota (IP hash + lifetime guest discover=1). Do not double-drive a shared guest identity.

## Helpers

`scripts/doctor` is executable. Invocation is in Doctor. No other helper ships with this skill.
