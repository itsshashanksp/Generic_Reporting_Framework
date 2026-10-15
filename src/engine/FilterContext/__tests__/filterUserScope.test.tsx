import { act, render, waitFor } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { executeRequestMock } = vi.hoisted(() => ({ executeRequestMock: vi.fn() }));

vi.mock("../../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../../api/request")>(),
    executeRequest: executeRequestMock,
}));

import { AuthProvider, useAuth } from "../../../auth";
import { FilterProvider, useFilters } from "..";

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

const SECRET = "Confidential Customer";
let renders: string[];
const probe: { current?: { auth: ReturnType<typeof useAuth>; filters: ReturnType<typeof useFilters> } } = {};

function Probe() {
    const auth = useAuth();
    const filters = useFilters();
    // Records every committed render, before the browser can paint it.
    useLayoutEffect(() => {
        probe.current = { auth, filters };
        const user = auth.state.status === "authenticated" ? auth.state.user.username : auth.state.status;
        renders.push(`${user}:${JSON.stringify(filters.filters)}`);
    });
    return null;
}

async function signInAsAliceWithFilter() {
    executeRequestMock.mockResolvedValueOnce(session("alice"));
    render(<AuthProvider><FilterProvider><Probe /></FilterProvider></AuthProvider>);
    await waitFor(() => expect(probe.current!.auth.state.status).toBe("authenticated"));
    act(() => probe.current!.filters.setFilter("Cust_Name", SECRET));
    expect(probe.current!.filters.filters).toEqual({ Cust_Name: SECRET });
    renders = [];
}

describe("filter values are scoped to the signed-in user", () => {
    let otherTab: BroadcastChannel;

    beforeEach(() => {
        renders = [];
        executeRequestMock.mockReset();
        otherTab = new BroadcastChannel("generic-reporting-auth");
    });
    afterEach(() => otherTab.close());

    it("never renders the previous user's filter values after sign-out", async () => {
        await signInAsAliceWithFilter();
        executeRequestMock.mockResolvedValueOnce(session(null));

        await act(async () => probe.current!.auth.logout());

        expect(probe.current!.filters.filters).toEqual({});
        expect(renders.filter(entry => entry.startsWith("unauthenticated")).join()).not.toContain(SECRET);
    });

    it("never shows the previous user's filter values to the next user", async () => {
        await signInAsAliceWithFilter();
        executeRequestMock.mockResolvedValueOnce(session("bob"));

        otherTab.postMessage({ type: "auth-changed" });

        await waitFor(() => expect(probe.current!.auth.state.status === "authenticated" && probe.current!.auth.state.user.username).toBe("bob"));
        expect(probe.current!.filters.filters).toEqual({});
        expect(renders.filter(entry => entry.startsWith("bob")).join()).not.toContain(SECRET);
    });

    it("discards the values on sign-out rather than restoring them at the next sign-in", async () => {
        await signInAsAliceWithFilter();
        executeRequestMock.mockResolvedValueOnce(session(null));
        await act(async () => probe.current!.auth.logout());
        executeRequestMock.mockResolvedValueOnce(session("alice"));

        await act(async () => probe.current!.auth.login("alice", "secret"));

        expect(probe.current!.filters.filters).toEqual({});
    });

    it("keeps the values when the backend confirms the same user", async () => {
        await signInAsAliceWithFilter();
        executeRequestMock.mockResolvedValueOnce(session("alice"));

        otherTab.postMessage({ type: "auth-changed" });
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(2));
        await new Promise(resolve => setTimeout(resolve, 30));

        expect(probe.current!.filters.filters).toEqual({ Cust_Name: SECRET });
    });
});
