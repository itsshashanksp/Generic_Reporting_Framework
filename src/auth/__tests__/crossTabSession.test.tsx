import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { executeRequestMock, clearRequestCacheMock } = vi.hoisted(() => ({
    executeRequestMock: vi.fn(),
    clearRequestCacheMock: vi.fn(),
}));

vi.mock("../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../api/request")>(),
    executeRequest: executeRequestMock,
}));
vi.mock("../../engine/RequestCache", () => ({ clearRequestCache: clearRequestCacheMock }));

import { apiClient } from "../../api/client";
import { AuthProvider, useAuth } from "../AuthContext";

const CHANNEL = "generic-reporting-auth";

function session(username: string | null) {
    return {
        success: true,
        message: "OK",
        data: [username
            ? { authenticated: true, user: { username, backendRole: null, frontendAccess: true, frontendRole: null } }
            : { authenticated: false, user: null }],
        meta: { page: null, pageSize: null, totalRows: 1, rowsReturned: 1, executionTime: null },
    };
}

/** Another browser tab of the same origin. */
function openOtherTab() {
    const received: unknown[] = [];
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = event => received.push(event.data);
    return { channel, received };
}

async function renderSignedIn(username = "alice") {
    executeRequestMock.mockResolvedValueOnce(session(username));
    const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
    const view = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(view.result.current.state.status).toBe("authenticated"));
    clearRequestCacheMock.mockClear();
    executeRequestMock.mockClear();
    return view;
}

const settle = () => new Promise(resolve => setTimeout(resolve, 30));

describe("cross-tab session synchronization", () => {
    let otherTab: ReturnType<typeof openOtherTab>;

    beforeEach(() => {
        executeRequestMock.mockReset();
        clearRequestCacheMock.mockReset();
        localStorage.clear();
        otherTab = openOtherTab();
    });

    afterEach(() => {
        otherTab.channel.close();
        vi.unstubAllGlobals();
    });

    it("signs this tab out and clears cached data after another tab signs out", async () => {
        const { result } = await renderSignedIn();
        localStorage.setItem("generic-report-saved-reports", "[]");
        executeRequestMock.mockResolvedValueOnce(session(null));

        otherTab.channel.postMessage({ type: "auth-changed" });

        await waitFor(() => expect(result.current.state).toEqual({ status: "unauthenticated", user: null }));
        expect(executeRequestMock).toHaveBeenCalledWith({ action: "auth.session" }, expect.anything());
        expect(clearRequestCacheMock).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem("generic-report-saved-reports")).toBeNull();
    });

    it("switches to the backend's current user after another tab signs in as someone else", async () => {
        const { result } = await renderSignedIn("alice");
        executeRequestMock.mockResolvedValueOnce(session("bob"));

        otherTab.channel.postMessage({ type: "auth-changed" });

        await waitFor(() => expect(result.current.state.status === "authenticated" && result.current.state.user.username).toBe("bob"));
        expect(clearRequestCacheMock).toHaveBeenCalledTimes(1);
    });

    it("fails closed when the session cannot be re-checked", async () => {
        const { result } = await renderSignedIn();
        executeRequestMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

        otherTab.channel.postMessage({ type: "auth-changed" });

        await waitFor(() => expect(result.current.state.status).toBe("unauthenticated"));
    });

    it("ignores unrelated messages", async () => {
        const { result } = await renderSignedIn();

        otherTab.channel.postMessage({ type: "something-else" });
        otherTab.channel.postMessage("auth-changed");
        otherTab.channel.postMessage(null);
        await settle();

        expect(executeRequestMock).not.toHaveBeenCalled();
        expect(result.current.state.status).toBe("authenticated");
    });

    it("tells other tabs about a logout without sending identity or credentials", async () => {
        const { result } = await renderSignedIn();
        executeRequestMock.mockResolvedValueOnce(session(null));

        await act(async () => result.current.logout());
        await waitFor(() => expect(otherTab.received).toEqual([{ type: "auth-changed" }]));
        expect(JSON.stringify(otherTab.received)).not.toMatch(/alice|token|csrf|cookie/i);
    });

    it("tells other tabs about a login", async () => {
        executeRequestMock.mockResolvedValueOnce(session(null));
        const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => expect(result.current.state.status).toBe("unauthenticated"));
        executeRequestMock.mockResolvedValueOnce(session("alice"));

        await act(async () => result.current.login("alice", "secret"));

        await waitFor(() => expect(otherTab.received).toEqual([{ type: "auth-changed" }]));
        expect(JSON.stringify(otherTab.received)).not.toContain("secret");
    });

    it("tells other tabs once when an expired session is detected, and re-checks never re-broadcast", async () => {
        await renderSignedIn();
        const expired = () => new Response(JSON.stringify({
            success: false,
            message: "Authentication required.",
            error: { code: "AUTHENTICATION_REQUIRED", details: [] },
            data: [],
        }), { status: 401, headers: { "Content-Type": "application/json" } });
        vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(expired())));

        await act(async () => {
            await Promise.all([
                apiClient({ action: "select" }).catch(() => undefined),
                apiClient({ action: "sql" }).catch(() => undefined),
            ]);
        });
        await waitFor(() => expect(otherTab.received).toEqual([{ type: "auth-changed" }]));

        executeRequestMock.mockResolvedValueOnce(session(null));
        otherTab.channel.postMessage({ type: "auth-changed" });
        await settle();
        expect(otherTab.received).toEqual([{ type: "auth-changed" }]);
    });

    it("stops listening after unmount", async () => {
        const { unmount } = await renderSignedIn();
        unmount();

        otherTab.channel.postMessage({ type: "auth-changed" });
        await settle();

        expect(executeRequestMock).not.toHaveBeenCalled();
    });

    it("works without BroadcastChannel; only immediate cross-tab sync is unavailable", async () => {
        otherTab.channel.close();
        vi.stubGlobal("BroadcastChannel", undefined);
        executeRequestMock.mockResolvedValueOnce(session(null));
        const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => expect(result.current.state.status).toBe("unauthenticated"));

        executeRequestMock.mockResolvedValueOnce(session("alice"));
        await act(async () => result.current.login("alice", "secret"));
        expect(result.current.state.status).toBe("authenticated");

        executeRequestMock.mockResolvedValueOnce(session(null));
        await act(async () => result.current.logout());
        expect(result.current.state).toEqual({ status: "unauthenticated", user: null });
        vi.unstubAllGlobals();
        otherTab = openOtherTab();
    });
});
