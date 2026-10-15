import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest runs from the project root.
const root = process.cwd();

/** Declared but not imported, kept deliberately until the noted decision. */
const PENDING_DECISIONS: Record<string, string> = {};

function sourceFiles(directory: string): string[] {
    return readdirSync(directory).flatMap(name => {
        const path = join(directory, name);
        if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
        return /\.(?:ts|tsx|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
}

const applicationSource = sourceFiles(resolve(root, "src"))
    .map(path => readFileSync(path, "utf8"))
    .join("\n");

function isImported(packageName: string): boolean {
    const escaped = packageName.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    return new RegExp(`(?:from|import|@import)\\s*\\(?\\s*["']${escaped}(?:/[^"']*)?["']`).test(applicationSource);
}

describe("dependency and asset usage", () => {
    const { dependencies } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
        dependencies: Record<string, string>;
    };

    it.each(Object.keys(dependencies))("runtime dependency %s is imported by application code", name => {
        if (name in PENDING_DECISIONS) return;
        expect(isImported(name), `${name} is declared but never imported`).toBe(true);
    });

    it("keeps pending decisions limited to declared, unimported packages", () => {
        Object.keys(PENDING_DECISIONS).forEach(name => {
            expect(dependencies).toHaveProperty(name);
            expect(isImported(name)).toBe(false);
        });
    });

    it("references every public asset from index.html or application code", () => {
        const references = readFileSync(resolve(root, "index.html"), "utf8") + applicationSource;
        readdirSync(resolve(root, "public")).forEach(name => {
            expect(references, `public/${name} is unused`).toContain(`/${name}`);
        });
    });
});
