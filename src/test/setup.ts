import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(
        new Error("Unexpected network request in frontend test.")
    )));
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
