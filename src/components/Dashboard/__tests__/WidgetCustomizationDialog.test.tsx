import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DashboardWidget } from "../../../types/widget";
import WidgetCustomizationDialog from "../WidgetCustomizationDialog";

const requestHook = vi.hoisted(() => vi.fn());
vi.mock("../useDashboardWidgetRequest", () => ({
    useDashboardWidgetRequest: (request: unknown) => {
        requestHook(request);
        return ({
        response: {
            success: true,
            message: "ok",
            data: [{ Category: "Long category", StockValue: 12908199.94 }],
            meta: { page: 1, pageSize: 10, totalRows: 1, rowsReturned: 1, executionTime: 1 },
        },
        loading: false,
        error: null,
        retry: vi.fn(),
        });
    },
}));

vi.mock("../ChartWidget", () => ({
    ChartViewport: ({ type }: { type: string }) => <div data-testid="chart-preview">{type}</div>,
}));

const columns = [
    { field: "Category", header: "Category", dataType: "text" as const },
    { field: "StockValue", header: "Stock Value", dataType: "currency" as const },
];
const widget: DashboardWidget = {
    id: "stock-value",
    type: "chart",
    title: "Stock Value by Category",
    queryDefinition: { format: "sql", resource: "widgets/item-stock-value-by-category" },
    xField: "Category",
    yField: "StockValue",
    chartType: "pie",
    presentation: {
        defaultView: "pie",
        allowedViews: ["table", "pie", "doughnut"],
        table: {
            columns,
            pagination: { pageSize: 10, pageSizeOptions: [10, 25] },
            export: { enabled: true, formats: ["csv", "excel"], exportAll: true },
        },
        chart: { xField: "Category", yField: "StockValue" },
    },
};
const options = [
    { view: "table" as const, label: "Table", available: true, reason: null },
    { view: "pie" as const, label: "Pie", available: true, reason: null },
    { view: "doughnut" as const, label: "Doughnut", available: false, reason: "Unavailable for this test" },
];
const tableState = { page: 3, pageSize: 10, sort: [], columnVisibility: { Category: true, StockValue: true } };

function renderDialog(overrides: Partial<Parameters<typeof WidgetCustomizationDialog>[0]> = {}) {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<WidgetCustomizationDialog
        widget={widget}
        options={options}
        activeView="table"
        tableState={tableState}
        chartOptions={{ valueFormat: "currency" }}
        filterDefinitions={[]}
        inheritedDatabase="loyal-ibms"
        runtimeFilterValues={{}}
        cacheScope="item:stock-value"
        canCustomizeChart={false}
        onApply={onApply}
        onClose={onClose}
        {...overrides}
    />);
    return { onApply, onClose };
}

describe("WidgetCustomizationDialog", () => {
    it("shows Table Settings immediately without rendering or requesting a table preview", () => {
        requestHook.mockClear();
        renderDialog();
        expect(screen.getByRole("dialog", { name: "Customize Widget" })).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Table Settings" })).toBeTruthy();
        expect(screen.queryByLabelText("table live preview")).toBeNull();
        expect(screen.queryByText("Long category")).toBeNull();
        expect(screen.queryByText("Unable to load preview")).toBeNull();
        expect(requestHook).toHaveBeenCalledWith(null);
        expect((screen.getByRole("button", { name: "Doughnut" }) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText("CSV, EXCEL")).toBeTruthy();
    });

    it("keeps drafts temporary until Save and preserves Cancel semantics", () => {
        const cancelled = renderDialog();
        fireEvent.click(screen.getByRole("button", { name: "Pie" }));
        expect(screen.getByTestId("chart-preview").textContent).toBe("pie");
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(cancelled.onApply).not.toHaveBeenCalled();
        expect(cancelled.onClose).toHaveBeenCalledTimes(1);
    });

    it("applies chart settings on Save and restores authored defaults through Reset", () => {
        const saved = renderDialog();
        fireEvent.click(screen.getByRole("button", { name: "Pie" }));
        fireEvent.click(screen.getByLabelText("Legend"));
        fireEvent.change(screen.getByLabelText("Top categories"), { target: { value: "5" } });
        fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
        expect(saved.onApply).toHaveBeenCalledWith(expect.objectContaining({
            view: "pie",
            tableState: expect.objectContaining({ page: 3 }),
            chartOptions: expect.objectContaining({ showLegend: true, topN: 5 }),
        }));

        const reset = renderDialog({ activeView: "pie" });
        fireEvent.click(screen.getAllByRole("button", { name: "Reset to Default" }).at(-1)!);
        fireEvent.click(screen.getAllByRole("button", { name: "Save Changes" }).at(-1)!);
        expect(reset.onApply).toHaveBeenCalledWith(expect.objectContaining({ view: "pie" }));
    });
});
