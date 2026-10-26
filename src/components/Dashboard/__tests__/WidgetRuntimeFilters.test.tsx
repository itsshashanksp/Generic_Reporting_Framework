import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardProvider } from "../../../engine/DashboardContext";
import { clearRequestCache } from "../../../engine/RequestCache";
import StatWidget from "../StatWidget";

const { executeRequestMock } = vi.hoisted(() => ({ executeRequestMock: vi.fn() }));
vi.mock("../../../api/request", () => ({
    executeRequest: executeRequestMock,
    getRequestErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Request failed",
    isRequestAbort: (error: unknown) => error instanceof Error && error.name === "AbortError",
}));

const request = { action: "select" as const, source: { table: "Orders" }, fields: ["Total"] };
const runtimeFilters = [{ field: "Status", label: "Status", type: "text" as const, operator: "equals" as const }];

describe("widget runtime filters", () => {
    beforeEach(() => {
        clearRequestCache();
        executeRequestMock.mockReset().mockResolvedValue({ success: true, message: "OK", data: [{ Total: 1 }] });
    });

    it("applies and resets filters only for the owning widget", async () => {
        render(
            <DashboardProvider>
                <StatWidget title="Filtered orders" request={request} valueField="Total" runtimeFilters={runtimeFilters} cacheScope="filtered" />
                <StatWidget title="Other orders" request={request} valueField="Total" cacheScope="other" />
            </DashboardProvider>
        );
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(2));

        fireEvent.click(screen.getByRole("button", { name: "Filter Filtered orders" }));
        fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Open" } });
        expect(executeRequestMock).toHaveBeenCalledTimes(2);
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(3));
        expect(executeRequestMock.mock.calls[2][0].filters).toEqual([{ field: "Status", operator: "=", value: "Open" }]);

        fireEvent.click(screen.getByRole("button", { name: "Filter Filtered orders" }));
        fireEvent.click(screen.getByRole("button", { name: "Reset" }));
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(3));
        expect(screen.getByRole("button", { name: "Filter Filtered orders" }).textContent).not.toContain("•");
    });

    it("uses the owning widget database for dynamic options unless explicitly pinned", async () => {
        const dynamic = [{
            field: "Status", label: "Status", type: "select" as const,
            dynamicOptions: {
                request: { action: "select" as const, source: { table: "Statuses" }, fields: ["Status"] },
                valueField: "Status",
            },
        }];
        executeRequestMock.mockImplementation(async input => ({
            success: true, message: "OK",
            data: input.source?.table === "Statuses" ? [{ Status: "Open" }] : [{ Total: 1 }],
        }));
        render(<DashboardProvider><StatWidget title="Orders" request={{ ...request, database: "archive" }} valueField="Total" runtimeFilters={dynamic} /></DashboardProvider>);
        fireEvent.click(await screen.findByRole("button", { name: "Filter Orders" }));
        await waitFor(() => expect(executeRequestMock.mock.calls.some(call => call[0].source?.table === "Statuses")).toBe(true));
        const optionRequest = executeRequestMock.mock.calls.map(call => call[0]).find(input => input.source?.table === "Statuses");
        expect(optionRequest.database).toBe("archive");
    });
});
