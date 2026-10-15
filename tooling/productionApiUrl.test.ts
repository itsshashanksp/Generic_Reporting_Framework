import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserConfigFnObject } from "vite";

import viteConfig from "../vite.config.ts";
import { getProductionApiUrlError } from "./productionApiUrl.ts";

function resolveConfig(mode: string, command: "build" | "serve" = "build", isPreview = false) {
    return (viteConfig as UserConfigFnObject)({ command, mode, isSsrBuild: false, isPreview });
}

describe("production API URL", () => {
    afterEach(() => vi.unstubAllEnvs());

    it.each([
        undefined,
        "",
        "/api",
        "/reports/api",
        "/api/index.php",
        "https://reports.example.internal/api",
        "http://reports.example.internal:8080/index.php",
        "https://10.0.0.5/api",
        "https://localhost.example.com/api",
        "https://127.example.com/api",
    ])(
        "accepts %j",
        value => expect(getProductionApiUrlError(value)).toBeNull()
    );

    it.each([
        "http://localhost:8000/index.php",
        "http://127.0.0.1:8000/index.php",
        "http://[::1]:8000/index.php",
        "http://0.0.0.0/api",
        "http://app.localhost/api",
        "HTTP://LOCALHOST/api",
        "//localhost/api",
        "//127.0.0.1:8000/index.php",
        "http://localhost./api",
        "http://127.0.0.2/api",
        "http://127.1/api",
        "http://2130706433/api",
        "http://0x7f.1/api",
        "http://[0:0:0:0:0:0:0:1]/api",
        "http://[::ffff:127.0.0.1]/api",
        "http://[::]/api",
        "https://user:pass@localhost/api",
    ])("rejects the loopback URL %j", value => {
        expect(getProductionApiUrlError(value)).toContain("loopback");
    });

    it.each(["not a url", "api", "localhost:8000/api", "http://"])("rejects the invalid or relative URL %j", value => {
        expect(getProductionApiUrlError(value)).toMatch(/not a valid URL|http\(s\) URL/);
    });

    it.each(["file:///C:/api", "ftp://reports.example.internal/api", "javascript:alert(1)"])(
        "rejects the non-http scheme %j",
        value => expect(getProductionApiUrlError(value)).toContain("http(s) URL")
    );

    it.each([" /api", "/api ", "\t/api"])("rejects surrounding whitespace in %j, which the client would send as-is", value => {
        expect(getProductionApiUrlError(value)).toContain("whitespace");
    });

    it("builds production with the same-origin /api from .env.production", () => {
        // Vitest exports the developer .env into process.env for its own test
        // mode; a real `vite build` process starts without it.
        vi.stubEnv("VITE_API_URL", undefined);
        expect(() => resolveConfig("production")).not.toThrow();
    });

    it("fails a production build when a loopback URL overrides .env.production", () => {
        vi.stubEnv("VITE_API_URL", "http://localhost:8000/index.php");
        expect(() => resolveConfig("production")).toThrow(/loopback/);
        expect(() => resolveConfig("development")).not.toThrow();
    });

    it("leaves supported non-production configurations unguarded", () => {
        vi.stubEnv("VITE_API_URL", "http://localhost:8000/index.php");
        expect(() => resolveConfig("development", "serve")).not.toThrow();
        expect(() => resolveConfig("test", "serve")).not.toThrow();
        expect(() => resolveConfig("staging")).not.toThrow();
    });

    it("lets vite preview resolve the production configuration from .env.production", () => {
        vi.stubEnv("VITE_API_URL", undefined);
        expect(() => resolveConfig("production", "serve", true)).not.toThrow();
    });
});
