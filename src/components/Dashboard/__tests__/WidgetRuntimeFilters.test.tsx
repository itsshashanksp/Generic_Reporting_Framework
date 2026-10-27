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
        render(<DashboardProvider><StatWidget title="Orders" request={{ ...request, database: "archive" }} valueField="Total" runtimeFilters={dynamic} runtimeFilterDisplay="dialog" /></DashboardProvider>);
        fireEvent.click(await screen.findByRole("button", { name: "Filter Orders" }));
        await waitFor(() => expect(executeRequestMock.mock.calls.some(call => call[0].source?.table === "Statuses")).toBe(true));
        const optionRequest = executeRequestMock.mock.calls.map(call => call[0]).find(input => input.source?.table === "Statuses");
        expect(optionRequest.database).toBe("archive");
    });

    it("resets local filters only when the effective database changes", async () => {
        const view = render(
            <DashboardProvider>
                <StatWidget title="Orders" request={{ ...request, database: "archive" }} valueField="Total" runtimeFilters={runtimeFilters} runtimeFilterDisplay="dialog" />
            </DashboardProvider>
        );
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByRole("button", { name: "Filter Orders" }));
        fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Open" } });
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Filter Orders" }).textContent).toContain("•"));

        view.rerender(
            <DashboardProvider>
                <StatWidget title="Orders" request={{ ...request, database: "archive" }} valueField="Total" runtimeFilters={runtimeFilters} runtimeFilterDisplay="dialog" />
            </DashboardProvider>
        );
        expect(screen.getByRole("button", { name: "Filter Orders" }).textContent).toContain("•");

        view.rerender(
            <DashboardProvider>
                <StatWidget title="Orders" request={{ ...request, database: "current" }} valueField="Total" runtimeFilters={runtimeFilters} runtimeFilterDisplay="dialog" />
            </DashboardProvider>
        );
        await waitFor(() => expect(screen.getByRole("button", { name: "Filter Orders" }).textContent).not.toContain("•"));
    });

    it("renders multiple filter controls and actions in an in-flow panel that closes cleanly", async () => {
        const filters = [
            { field: "Amount", label: "Order amount with a long descriptive label", type: "number" as const },
            { field: "CreatedAt", label: "Created", type: "daterange" as const, operator: "between" as const },
            ...runtimeFilters,
        ];
        const { container } = render(
            <DashboardProvider>
                <StatWidget title="Orders" request={request} valueField="Total" runtimeFilters={filters} />
            </DashboardProvider>
        );
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(1));

        fireEvent.click(screen.getByRole("button", { name: "Filter Orders" }));

        const panel = container.querySelector(".widget-filter-panel");
        expect(panel).not.toBeNull();
        expect(panel?.parentElement?.classList.contains("dashboard-widget-content")).toBe(true);
        expect(screen.getByLabelText("Order amount with a long descriptive label").getAttribute("type")).toBe("number");
        expect(screen.getByLabelText("Created start").getAttribute("type")).toBe("date");
        expect(screen.getByRole("button", { name: "Apply" }).closest(".widget-filter-panel")).toBe(panel);
        expect(screen.getByRole("button", { name: "Reset" }).closest(".widget-filter-panel")).toBe(panel);

        fireEvent.click(screen.getByRole("button", { name: "Filter Orders" }));
        expect(container.querySelector(".widget-filter-panel")).toBeNull();
    });

    it("uses a modal dialog without changing inline-mode defaults and discards canceled drafts", async () => {
        render(
            <DashboardProvider>
                <StatWidget title="Orders" request={request} valueField="Total" runtimeFilters={runtimeFilters} runtimeFilterDisplay="dialog" />
            </DashboardProvider>
        );
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(1));
        const trigger = screen.getByRole("button", { name: "Filter Orders" });
        fireEvent.click(trigger);
        const dialog = screen.getByRole("dialog", { name: "Filter Orders" });
        expect(document.body.contains(dialog)).toBe(true);
        fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Draft" } });
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.queryByRole("dialog", { name: "Filter Orders" })).toBeNull();

        fireEvent.click(trigger);
        expect((screen.getByLabelText("Status") as HTMLInputElement).value).toBe("");
        fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Open" } });
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(2));
        expect(executeRequestMock.mock.calls[1][0].filters).toEqual([{ field: "Status", operator: "=", value: "Open" }]);

        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole("button", { name: "Reset" }));
        expect(trigger.textContent).not.toContain("•");
    });

    it("closes dialog filters with Escape, restores focus, and traps Tab navigation", async () => {
        render(
            <DashboardProvider>
                <StatWidget title="Orders" request={request} valueField="Total" runtimeFilters={runtimeFilters} runtimeFilterDisplay="dialog" />
            </DashboardProvider>
        );
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(1));
        const trigger = screen.getByRole("button", { name: "Filter Orders" });
        fireEvent.click(trigger);
        const dialog = screen.getByRole("dialog", { name: "Filter Orders" });
        const close = screen.getByRole("button", { name: "Close" });
        const cancel = screen.getByRole("button", { name: "Cancel" });
        cancel.focus();
        fireEvent.keyDown(dialog, { key: "Tab" });
        expect(document.activeElement).toBe(close);
        fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filter Orders" })).toBeNull());
        await waitFor(() => expect(document.activeElement).toBe(trigger));
    });

    it.each([
        [
            { field: "CreatedAt", label: "Created", type: "daterange" as const, operator: "between" as const },
            "Created start",
            "2026-10-01",
        ],
        [
            { field: "Amount", label: "Amount", type: "number" as const, operator: "between" as const },
            "Amount minimum",
            "10",
        ],
    ])("does not request data for an incomplete $type range", async (definition, inputLabel, value) => {
        render(
            <DashboardProvider>
                <StatWidget title="Orders" request={request} valueField="Total" runtimeFilters={[definition]} runtimeFilterDisplay="dialog" />
            </DashboardProvider>
        );
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByRole("button", { name: "Filter Orders" }));
        fireEvent.change(screen.getByLabelText(inputLabel), { target: { value } });
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));

        expect(screen.getByRole("alert").textContent).toContain("requires both");
        expect(executeRequestMock).toHaveBeenCalledTimes(1);
    });
});
