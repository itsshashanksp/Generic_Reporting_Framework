import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardWidget } from "../../types/widget";

vi.mock("../../components/Dashboard/TableWidget", () => ({
    default: (props: {
        headerActions?: ReactNode;
        viewState?: { page: number; pageSize: number; sort: unknown[]; columnVisibility: Record<string, boolean> };
        onViewStateChange?: (state: { page: number; pageSize: number; sort: Array<{ field: string; direction: "ASC" }>; columnVisibility: Record<string, boolean> }) => void;
        onRuntimeFilterValuesChange?: (values: Record<string, unknown>) => void;
    }) => <div data-testid="table-widget">
        {props.headerActions}
        <output data-testid="table-state">{JSON.stringify(props.viewState)}</output>
        <button type="button" onClick={() => props.onViewStateChange?.({
            page: 3,
            pageSize: 25,
            sort: [{ field: "Value", direction: "ASC" }],
            columnVisibility: { Category: true, Value: false },
        })}>Set table state</button>
        <button type="button" onClick={() => props.onRuntimeFilterValuesChange?.({ Region: "West" })}>Set runtime filter</button>
    </div>,
}));

vi.mock("../../components/Dashboard/ChartWidget", () => ({
    default: (props: { headerActions?: ReactNode; presentationChartType?: string; presentationOrientation?: string; runtimeFilterValues?: Record<string, unknown> }) => <div data-testid="chart-widget">
        {props.headerActions}
        <output data-testid="chart-view">{`${props.presentationChartType}:${props.presentationOrientation ?? "default"}`}</output>
        <output data-testid="chart-runtime-filters">{JSON.stringify(props.runtimeFilterValues)}</output>
    </div>,
}));

vi.mock("../../components/Dashboard/WidgetCustomizationDialog", () => ({
    default: function MockWidgetCustomizationDialog(props: {
        activeView: string;
        tableState: { page: number; pageSize: number; sort: unknown[]; columnVisibility: Record<string, boolean> };
        onApply: (value: { view: string; tableState: unknown; chartOptions: object }) => void;
        onClose: () => void;
    }) {
        const [view, setView] = useState(props.activeView);
        return <div role="dialog" aria-label="Customize Widget">
            {(["table", "column", "pie"] as const).map(option => <button key={option} type="button" onClick={() => setView(option)}>{option}</button>)}
            <button type="button" onClick={() => { props.onApply({ view, tableState: props.tableState, chartOptions: {} }); props.onClose(); }}>Save Changes</button>
        </div>;
    },
}));

import { DashboardWidgetCard } from "../Dashboard";

const columns = [
    { field: "Category", header: "Category", dataType: "text" as const },
    { field: "Value", header: "Value", dataType: "currency" as const },
];
const widget: DashboardWidget = {
    id: "orders",
    type: "table",
    title: "Orders",
    width: 12,
    request: { action: "select", source: { table: "Orders" }, fields: ["Category", "Value"] },
    columns,
    pagination: { pageSize: 10, pageSizeOptions: [10, 25, 50] },
    presentation: {
        defaultView: "table",
        allowedViews: ["table", "column", "bar", "pie"],
        chart: {
            request: { action: "select", source: { table: "OrderSummary" }, fields: ["Category", "Value"] },
            columns,
            xField: "Category",
            yField: "Value",
        },
    },
};

function renderCard(target: DashboardWidget = widget) {
    return render(<DashboardWidgetCard
        widget={target}
        dashboardId="presentation-dashboard"
        filterDefinitions={[]}
        inheritedDatabase="abc"
        columns={12}
        tabletColumns={6}
        mobileColumns={1}
        canCustomizeChart={false}
    />);
}

describe("DashboardWidget presentation switching", () => {
    beforeEach(() => vi.clearAllMocks());

    it("switches table to chart through one customization dialog and restores independent table state", () => {
        renderCard();
        fireEvent.click(screen.getByRole("button", { name: "Set table state" }));
        fireEvent.click(screen.getByRole("button", { name: "Set runtime filter" }));
        expect(screen.getByTestId("table-state").textContent).toContain('"page":3');

        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        fireEvent.click(screen.getByRole("button", { name: "pie" }));
        fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
        expect(screen.getByTestId("chart-view").textContent).toContain("pie:default");
        expect(screen.getByTestId("chart-runtime-filters").textContent).toContain('"Region":"West"');

        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        fireEvent.click(screen.getByRole("button", { name: "column" }));
        fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
        expect(screen.getByTestId("chart-view").textContent).toContain("bar:vertical");

        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        fireEvent.click(screen.getByRole("button", { name: "table" }));
        fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
        expect(screen.getByTestId("table-state").textContent).toContain('"page":3');
        expect(screen.getByTestId("table-state").textContent).toContain('"pageSize":25');
        expect(screen.getByTestId("table-state").textContent).toContain('"Value":false');
    });

    it("keeps switching disabled widgets on their legacy renderer while exposing the universal dialog", () => {
        renderCard({
            ...widget,
            presentation: { ...widget.presentation!, allowSwitching: false },
        });
        expect(screen.getByTestId("table-widget")).not.toBeNull();
        expect(screen.getByRole("button", { name: "Customize" })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        expect(screen.getByRole("dialog", { name: "Customize Widget" })).toBeTruthy();
    });

    it("supports chart to table with the same identity and layout", () => {
        renderCard({
            ...widget,
            type: "chart",
            chartType: "pie",
            xField: "Category",
            yField: "Value",
            presentation: {
                defaultView: "pie",
                allowedViews: ["table", "pie"],
                table: { columns },
                chart: { xField: "Category", yField: "Value" },
            },
        });
        expect(screen.getByTestId("chart-widget")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        fireEvent.click(screen.getByRole("button", { name: "table" }));
        fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
        expect(screen.getByTestId("table-widget")).not.toBeNull();
        expect(document.querySelector('[data-dashboard-widget="orders"]')).not.toBeNull();
    });
});
