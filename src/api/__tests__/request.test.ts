import { describe, expect, it } from "vitest";

import { ApiClientError } from "../client";
import { getRequestErrorMessage, isNetworkError, isRequestAbort } from "../request";
import { ExportFileError } from "../../engine/ExportEngine";

const NETWORK_MESSAGE = "The data service could not be reached. Check the network connection and try again.";
const FALLBACK = "Unable to prepare the export.";

describe("request error classification", () => {
    it.each([
        "Failed to fetch",
        "NetworkError when attempting to fetch resource.",
        "Load failed",
        "fetch failed",
        " failed to fetch ",
    ])("reports the fetch network failure %j as unreachable", message => {
        expect(isNetworkError(new TypeError(message))).toBe(true);
        expect(getRequestErrorMessage(new TypeError(message), FALLBACK)).toBe(NETWORK_MESSAGE);
    });

    it.each([
        new TypeError("Cannot read properties of undefined (reading 'length')"),
        new TypeError("rows.map is not a function"),
        new ReferenceError("document is not defined"),
        new RangeError("Invalid array length"),
        new SyntaxError("Unexpected token < in JSON at position 0"),
    ])("shows the fallback, not a network message or internals, for %s", error => {
        expect(isNetworkError(error)).toBe(false);
        expect(getRequestErrorMessage(error, FALLBACK)).toBe(FALLBACK);
    });

    it("does not treat a non-TypeError with a fetch-like message as a network failure", () => {
        expect(isNetworkError(new Error("Failed to fetch"))).toBe(false);
        expect(getRequestErrorMessage(new Error("Failed to fetch"), FALLBACK)).toBe("Failed to fetch");
    });

    it("keeps backend and client messages unchanged", () => {
        expect(getRequestErrorMessage(
            new ApiClientError("Invalid SQL resource.", 400, { code: "INVALID_SQL_RESOURCE", details: [] }),
            FALLBACK
        )).toBe("Invalid SQL resource.");
        expect(getRequestErrorMessage(new Error("The API returned HTTP 502."), FALLBACK)).toBe("The API returned HTTP 502.");
    });

    it("adds backend validation details so the error says what to fix", () => {
        expect(getRequestErrorMessage(new ApiClientError("Invalid request.", 400, {
            code: "INVALID_REQUEST",
            details: [
                { path: "pagination.pageSize", message: "Page size exceeds the configured maximum." },
                { path: "pagination.pageSize", message: "Page size exceeds the configured maximum." },
                "unstructured detail",
                { attemptsRemaining: 2 },
            ],
        }), FALLBACK)).toBe("Invalid request. pagination.pageSize: Page size exceeds the configured maximum.");
        expect(getRequestErrorMessage(new ApiClientError("Invalid credentials.", 401, {
            code: "AUTHENTICATION_FAILED",
            details: [{ attemptsRemaining: 2 }],
        }), FALLBACK)).toBe("Invalid credentials.");
    });

    it("shows the friendly message of a local export file failure", () => {
        const error = new ExportFileError("The Excel file could not be created.", { cause: new TypeError("internal") });
        expect(getRequestErrorMessage(error, FALLBACK)).toBe("The Excel file could not be created.");
    });

    it("falls back for empty messages and non-Error values", () => {
        expect(getRequestErrorMessage(new Error(""), FALLBACK)).toBe(FALLBACK);
        expect(getRequestErrorMessage("boom", FALLBACK)).toBe(FALLBACK);
        expect(getRequestErrorMessage(undefined)).toBe("An unexpected error occurred while loading data.");
    });

    it("still recognizes aborted requests separately", () => {
        expect(isRequestAbort(Object.assign(new Error("The request was aborted."), { name: "AbortError" }))).toBe(true);
        expect(isRequestAbort(new TypeError("Failed to fetch"))).toBe(false);
    });
});
