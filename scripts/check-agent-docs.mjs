import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DOC_FILES = [
    "AGENTS.md",
    "docs/agents/README.md",
    "docs/agents/product-intent.md",
    "docs/agents/FEATURES.md",
    "docs/agents/architecture.md",
    "docs/agents/lib-index.md",
    "docs/agents/add-a-feature.md",
    "docs/agents/conventions.md",
    "docs/agents/gates.md",
    "docs/agents/token-efficiency.md",
    "docs/agents/env.md",
];

const REQUIRED_PATHS = [
    ...DOC_FILES,
    ".env.example",
    "package.json",
    "src/middleware.ts",
    "src/app/discover/discover-types.ts",
    "src/app/api/discover/report-types.ts",
    "src/app/api/discover/agent.ts",
    "src/app/lib/paper-sources.ts",
    "src/app/lib/entitlements.ts",
    "src/app/lib/content-access-policy.ts",
    "src/app/api/authMiddleware.ts",
];

const PATH_RE =
    /(?:^|[\s`"'(\[])((?:src|docs|scripts)\/[\w./?*[\]-]+|AGENTS\.md|\.env\.example|package\.json|vercel\.json|instrumentation-client\.ts)/gm;

function collectMarkdownFiles() {
    return DOC_FILES.map((file) => join(ROOT, file));
}

export function extractDocumentedPaths(markdown) {
    const found = new Set();
    for (const match of markdown.matchAll(PATH_RE)) {
        const raw = match[1].replace(/[.,;:)]+$/, "");
        if (raw.includes("://")) continue;
        found.add(raw);
    }
    return [...found];
}

function pathExists(repoPath) {
    const abs = join(ROOT, repoPath);
    if (existsSync(abs)) return true;
    if (!/[*?]/.test(repoPath)) return false;

    const parts = repoPath.split("/");
    let current = ROOT;
    for (const part of parts) {
        if (!/[*?]/.test(part)) {
            current = join(current, part);
            if (!existsSync(current)) return false;
            continue;
        }
        if (!existsSync(current) || !statSync(current).isDirectory()) {
            return false;
        }
        const rex = new RegExp(
            `^${part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`,
        );
        const hits = readdirSync(current).filter((name) => rex.test(name));
        if (hits.length === 0) return false;
        // Globs only need one match (e.g. src/app/api/discover/*.test.ts).
        return true;
    }
    return existsSync(current);
}

export function checkAgentDocs({ root = ROOT } = {}) {
    const missingDocs = DOC_FILES.filter((file) => !existsSync(join(root, file)));
    const missingRequired = REQUIRED_PATHS.filter(
        (file) => !existsSync(join(root, file)),
    );
    const documented = new Set();
    const missingDocumented = [];

    for (const file of collectMarkdownFiles()) {
        if (!existsSync(file)) continue;
        const markdown = readFileSync(file, "utf8");
        for (const repoPath of extractDocumentedPaths(markdown)) {
            documented.add(repoPath);
            if (!pathExists(repoPath)) {
                missingDocumented.push({
                    path: repoPath,
                    from: relative(root, file),
                });
            }
        }
    }

    return {
        ok:
            missingDocs.length === 0 &&
            missingRequired.length === 0 &&
            missingDocumented.length === 0,
        missingDocs,
        missingRequired,
        missingDocumented,
        documentedCount: documented.size,
    };
}

const isMain =
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    const result = checkAgentDocs();
    if (!result.ok) {
        if (result.missingDocs.length) {
            console.error("Missing agent docs:", result.missingDocs.join(", "));
        }
        if (result.missingRequired.length) {
            console.error(
                "Missing required paths:",
                result.missingRequired.join(", "),
            );
        }
        for (const item of result.missingDocumented) {
            console.error(`Missing ${item.path} (from ${item.from})`);
        }
        process.exit(1);
    }
    console.log(
        `Agent docs OK (${result.documentedCount} documented paths checked).`,
    );
}
