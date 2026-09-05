# Expansive Mind verification map

This directory is the maintained source for verifying user-facing behavior. Read this index, then use the matching feature file as the recipe.

## Baseline preconditions

- Target `$EM_VERIFY_BASE_URL` (local `http://127.0.0.1:3000` from `npm run dev`, or `https://expansivemind.ai` for read-only checks).
- Run `.cursor/skills/verify-expansive-mind/scripts/doctor` and require a pass.
- Use a disposable browser profile. A leftover `auth_token` fails anonymous doctor.
- Never `POST` Discover, share, or brief against production.
- Prefer a signed-in Free or Pro user for share and paper summary. Guest Discover is one lifetime run per network and cannot share.

## Driving conventions

- Start every recipe from the baseline unless the file says otherwise.
- Prefer `#discover-question`, `aria-label`, and visible button names over CSS classes.
- Treat quoted names as literal.
- After a mutation, open a second view (shared `/brief/{slug}` with no cookie).
- Keep proof artifacts. Do not delete `$EVIDENCE_DIR` during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes a screenshot with Expansive Mind chrome visible and the control you used.
- Mutation proof includes a logged-out GET of `/brief/{slug}`.
- Record the feature ID and entry point with every artifact.
- Report an unreachable path with the attempted URL or control and the unmet precondition (auth, quota, license, keys).
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 and one paragraph. It then uses exactly four H2 sections in this order.

1. `Sub-features`
2. `How to get to it (user POV)`
3. `Driving it with the browser`
4. `Gotchas`

## Features

- [Discover](./discover.md) covers the question form, progress, opportunity report, and guest vs signed-in share affordance.
- [Shareable brief](./shareable-brief.md) covers Discover share, paper summary share, and the public `/brief/{slug}` page.
- [Paper reader](./paper-reader.md) covers opening a cited paper from a report, load, tools, and chat.
