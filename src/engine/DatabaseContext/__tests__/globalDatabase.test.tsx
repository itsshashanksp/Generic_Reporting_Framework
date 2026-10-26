import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearRequestCache } from "../../RequestCache";
import { GlobalDatabaseProvider } from "../DatabaseContext";
import { useGlobalDatabase } from "../useGlobalDatabase";

const { executeRequestMock, authState } = vi.hoisted(() => ({
    executeRequestMock: vi.fn(),
    authState: { username: "alice" },
}));

vi.mock("../../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../../api/request")>(),
    executeRequest: executeRequestMock,
}));

vi.mock("../../../auth", () => ({
    useAuth: () => ({
        state: {
            status: "authenticated",
            user: { username: authState.username },
        },
    }),
}));

const registry = [
    { id: "primary", name: "Primary", default: true, enabled: true, available: true },
    { id: "archive", name: "Archive", default: false, enabled: true, available: true },
    { id: "offline", name: "Offline", default: false, enabled: true, available: false },
];

function response(data = registry) {
    return {
        success: true,
        message: "OK",
        data,
        meta: { page: null, pageSize: null, totalRows: data.length, rowsReturned: data.length, executionTime: 1 },
    };
}

function Probe() {
    const global = useGlobalDatabase();
    return <>
        <span data-testid="database">{global.database}</span>
        <span data-testid="configured">{global.configuredDatabase}</span>
        <span data-testid="status">{global.registry.status}</span>
        <button onClick={() => global.save("archive")}>Save archive</button>
        <button onClick={() => global.save("")}>Use backend default</button>
    </>;
}

describe("GlobalDatabaseProvider", () => {
    beforeEach(() => {
        clearRequestCache();
        localStorage.clear();
        authState.username = "alice";
        executeRequestMock.mockReset().mockResolvedValue(response());
    });

    it("keeps existing behavior when no global database is configured", async () => {
        render(<GlobalDatabaseProvider><Probe /></GlobalDatabaseProvider>);
        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"));
        expect(screen.getByTestId("database").textContent).toBe("");
    });

    it("validates and restores a persisted selection", async () => {
        localStorage.setItem("generic-report-global-database:user:alice", "archive");
        const first = render(<GlobalDatabaseProvider><Probe /></GlobalDatabaseProvider>);
        await waitFor(() => expect(screen.getByTestId("database").textContent).toBe("archive"));
        first.unmount();

        render(<GlobalDatabaseProvider><Probe /></GlobalDatabaseProvider>);
        await waitFor(() => expect(screen.getByTestId("database").textContent).toBe("archive"));
    });

    it.each(["Bad Id", "offline", "unknown"])("ignores invalid or unavailable stored database %s", async database => {
        localStorage.setItem("generic-report-global-database:user:alice", database);
        render(<GlobalDatabaseProvider><Probe /></GlobalDatabaseProvider>);
        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"));
        expect(screen.getByTestId("database").textContent).toBe("");
    });

    it("fails closed when metadata discovery fails", async () => {
        localStorage.setItem("generic-report-global-database:user:alice", "archive");
        executeRequestMock.mockRejectedValue(new Error("Denied"));
        render(<GlobalDatabaseProvider><Probe /></GlobalDatabaseProvider>);
        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("failed"));
        expect(screen.getByTestId("database").textContent).toBe("");
    });

    it("scopes persistence by authenticated username", async () => {
        localStorage.setItem("generic-report-global-database:user:alice", "archive");
        localStorage.setItem("generic-report-global-database:user:bob", "primary");
        const first = render(<GlobalDatabaseProvider><Probe /></GlobalDatabaseProvider>);
        await waitFor(() => expect(screen.getByTestId("database").textContent).toBe("archive"));
        first.unmount();
        authState.username = "bob";
        clearRequestCache();

        render(<GlobalDatabaseProvider><Probe /></GlobalDatabaseProvider>);
        await waitFor(() => expect(screen.getByTestId("database").textContent).toBe("primary"));
    });
});
