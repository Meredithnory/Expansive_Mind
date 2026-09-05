# Token-efficiency rules

## Read this much

1. `AGENTS.md`
2. One row in [FEATURES.md](FEATURES.md)
3. The entry file + colocated test
4. Stop

Read [architecture.md](architecture.md) only if the feature spans auth, quota, or more than one route. Read [lib-index.md](lib-index.md) instead of opening every `lib/` file.

## Do not

- Grep `.` or `src/` with a vague term (`paper`, `user`, `search`, `admin`) to “learn the app.”
- Open the god-file list in FEATURES.md for orientation.
- `@`-mention whole directories.
- Re-derive the Discover pipeline from `DiscoverClient.tsx`. Pipeline is `agent.ts` + the files it imports; UI types are `discover-types.ts`.
- Duplicate types that already live in `report-types.ts`, `project-types.ts`, or `session-types.ts`.

## Targeted search

```bash
# symbol you already know
rg -n "function consumeQuota" src

# one feature folder
rg -n "OpportunityReport" src/app/api/discover src/app/discover src/app/lib/evidence-type.ts
```

## God-file substitutes

| Instead of | Read |
| --- | --- |
| `DiscoverClient.tsx` | `discover-types.ts`, `page.tsx`, `api/discover/route.ts` |
| `api/discover/agent.ts` | function list + FEATURES “Discover pipeline” row |
| `api/paper/utils.ts` | `api/paper/sources.ts`, `load-paper.ts` |
| `Chatbox.tsx` / `Paperbox.tsx` | `chat-messages.ts`, `paper-citation.ts`, `aichat/route.ts` |
| `search/utils.ts` | `api/search/route.ts`, `lib/paper-sources.ts` |

## Context budget

- Prefer a 20-line helper over a 20-file “while I'm here.”
- If a file is >400 lines, extract a type or a pure function next to it — do not split the island in the same PR unless that is the task.
