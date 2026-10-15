import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Vitest runs from the project root.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
// tsconfig files are JSONC; parse them the way tsc does.
const readTsconfig = (path: string) => ts.parseConfigFileTextToJson(path, read(path)).config;

describe("TypeScript checks", () => {
    const typecheck: string = JSON.parse(read("package.json")).scripts.typecheck;

    it("type-checks every project referenced by the root tsconfig", () => {
        const references: { path: string }[] = readTsconfig("tsconfig.json").references;

        expect(references.length).toBeGreaterThan(0);
        references.forEach(({ path }) => {
            expect(typecheck).toContain(`tsc -p ${path.replace(/^\.\//, "")}`);
        });
    });

    it("keeps the Node project covering the build configuration and tooling", () => {
        const include: string[] = readTsconfig("tsconfig.node.json").include;
        expect(include).toEqual(expect.arrayContaining(["vite.config.ts", "tooling"]));
    });

    it.each([".github/workflows/frontend-ci.yml", "README.md", "CONTRIBUTING.md", "docs/TESTING.md", "docs/DEVELOPMENT.md", "docs/GETTING-STARTED.md"])(
        "%s runs the real type check instead of the root no-op",
        path => {
            const text = read(path);
            expect(text).toContain("npm run typecheck");
            expect(text).not.toMatch(/^\s*(?:run:\s*)?npx tsc --noEmit\s*$/m);
        }
    );
});
