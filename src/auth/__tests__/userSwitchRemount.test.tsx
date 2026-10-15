import { render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { executeRequestMock } = vi.hoisted(() => ({ executeRequestMock: vi.fn() }));
let mounts = 0;

vi.mock("../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../api/request")>(),
    executeRequest: executeRequestMock,
}));
vi.mock("../../components/Layout/Layout", () => ({
    default: () => <div data-testid="application-layout"><Outlet /></div>,
}));
vi.mock("../../pages/DashboardViewer", () => ({
    default: function DashboardPage() {
        // Page-local state stands in for a previous user's rows and filters.
        const [instance] = useState(() => ++mounts);
        return <div>Dashboard instance {instance}</div>;
    },
}));

import { ApplicationRoutes } from "../../router/AppRouter";
import { SetupProvider, useSetup } from "../../setup";
import { AuthProvider } from "../AuthContext";

function response(data: Record<string, unknown>) {
    return {
        success: true,
        message: "OK",
        data: [data],
        meta: { page: null, pageSize: null, totalRows: 1, rowsReturned: 1, executionTime: null },
    };
}
const signedIn = (username: string) => response({
    authenticated: true,
    user: { username, backendRole: null, frontendAccess: true, frontendRole: null },
});

function Providers({ children }: { children: ReactNode }) {
    const { state } = useSetup();
    return <AuthProvider enabled={state.status === "complete"}>{children}</AuthProvider>;
}

describe("user switch", () => {
    let otherTab: BroadcastChannel;

    beforeEach(() => {
        mounts = 0;
        executeRequestMock.mockReset();
        otherTab = new BroadcastChannel("generic-reporting-auth");
    });
    afterEach(() => otherTab.close());

    it("remounts protected pages so no previous user's page state survives", async () => {
        executeRequestMock
            .mockResolvedValueOnce(response({ initialized: true }))
            .mockResolvedValueOnce(signedIn("alice"));
        render(
            <SetupProvider>
                <Providers>
                    <MemoryRouter initialEntries={["/"]}>
                        <ApplicationRoutes />
                    </MemoryRouter>
                </Providers>
            </SetupProvider>
        );
        expect(await screen.findByText("Dashboard instance 1")).toBeTruthy();

        executeRequestMock.mockResolvedValueOnce(signedIn("bob"));
        otherTab.postMessage({ type: "auth-changed" });

        expect(await screen.findByText("Dashboard instance 2")).toBeTruthy();
        expect(screen.queryByText("Dashboard instance 1")).toBeNull();
    });

    it("keeps the page mounted when the same user is confirmed", async () => {
        executeRequestMock
            .mockResolvedValueOnce(response({ initialized: true }))
            .mockResolvedValueOnce(signedIn("alice"));
        render(
            <SetupProvider>
                <Providers>
                    <MemoryRouter initialEntries={["/"]}>
                        <ApplicationRoutes />
                    </MemoryRouter>
                </Providers>
            </SetupProvider>
        );
        await screen.findByText("Dashboard instance 1");

        executeRequestMock.mockResolvedValueOnce(signedIn("alice"));
        otherTab.postMessage({ type: "auth-changed" });
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(3));
        await new Promise(resolve => setTimeout(resolve, 30));

        expect(screen.getByText("Dashboard instance 1")).toBeTruthy();
        expect(mounts).toBe(1);
    });

    it("removes protected page content when another tab signs out", async () => {
        executeRequestMock
            .mockResolvedValueOnce(response({ initialized: true }))
            .mockResolvedValueOnce(signedIn("alice"));
        render(
            <SetupProvider>
                <Providers>
                    <MemoryRouter initialEntries={["/"]}>
                        <ApplicationRoutes />
                    </MemoryRouter>
                </Providers>
            </SetupProvider>
        );
        await screen.findByText("Dashboard instance 1");

        executeRequestMock.mockResolvedValueOnce(response({ authenticated: false, user: null }));
        otherTab.postMessage({ type: "auth-changed" });

        await waitFor(() => expect(screen.queryByText(/Dashboard instance/)).toBeNull());
        expect(screen.queryByTestId("application-layout")).toBeNull();
    });
});
