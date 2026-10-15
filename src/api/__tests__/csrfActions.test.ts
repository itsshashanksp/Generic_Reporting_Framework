import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient, clearCsrfToken } from "../client";

const TOKEN = "c".repeat(64);

function ok(data: Record<string, unknown>[] = []) {
    return new Response(JSON.stringify({
        success: true,
        message: "ok",
        data,
        meta: { page: null, pageSize: null, totalRows: data.length, rowsReturned: data.length, executionTime: null },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function stubFetch() {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        const action = JSON.parse(init.body as string).action;
        return Promise.resolve(action === "auth.csrf" ? ok([{ csrfToken: TOKEN }]) : ok());
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

function sentRequest(fetchMock: ReturnType<typeof vi.fn>, action: string) {
    const call = fetchMock.mock.calls.find(([, init]) => JSON.parse((init as RequestInit).body as string).action === action);
    return call?.[1] as RequestInit | undefined;
}

describe("CSRF action list", () => {
    afterEach(() => {
        clearCsrfToken();
        vi.unstubAllGlobals();
    });

    it.each([
        "auth.login",
        "auth.logout",
        "auth.frontendUsers.create",
        "auth.frontendUsers.update",
        "auth.frontendUsers.enable",
        "auth.frontendUsers.disable",
        "auth.frontendUsers.delete",
        "auth.frontendUsers.changePassword",
        "auth.frontendUsers.assignRole",
        "insert",
        "update",
        "delete",
        "upsert",
    ])("sends a CSRF token with the state-changing action %s", async action => {
        const fetchMock = stubFetch();

        await apiClient({ action }).catch(() => undefined);

        const init = sentRequest(fetchMock, action);
        expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe(TOKEN);
        expect(init).toMatchObject({ method: "POST", credentials: "include" });
    });

    it.each([
        "setup.status",
        "auth.session",
        "auth.frontendUsers.list",
        "select",
        "sql",
        // Admin Console actions: the public API returns 404 for them, and the
        // frontend never sends them.
        "auth.users.create",
        "auth.users.update",
        "auth.users.assignAuthorization",
    ])("sends %s without fetching a CSRF token", async action => {
        const fetchMock = stubFetch();

        await apiClient({ action }).catch(() => undefined);

        expect(sentRequest(fetchMock, "auth.csrf")).toBeUndefined();
        expect(new Headers(sentRequest(fetchMock, action)?.headers).has("X-CSRF-Token")).toBe(false);
    });
});
