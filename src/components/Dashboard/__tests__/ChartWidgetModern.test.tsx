import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardProvider } from "../../../engine/DashboardContext";
import { clearRequestCache } from "../../../engine/RequestCache";
import ChartWidget from "../ChartWidget";
import { ToastProvider } from "../../Notifications/ToastProvider";

const mocks = vi.hoisted(() => ({
    executeRequest: vi.fn(), exportPng: vi.fn(), exportSvg: vi.fn(), exportCsv: vi.fn(), exportExcel: vi.fn(),
}));
vi.mock("../../../api/request", () => ({
    executeRequest: mocks.executeRequest,
    getRequestErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
    isRequestAbort: () => false,
}));
vi.mock("../../../engine/ExportEngine", () => ({
    exportChartPNG: mocks.exportPng,
    exportChartSVG: mocks.exportSvg,
    exportRowsCSV: mocks.exportCsv,
    exportExcel: mocks.exportExcel,
}));
vi.mock("recharts", () => {
    const container = ({ children }: { children: ReactNode }) => <div data-testid="responsive-chart">{children}</div>;
    const series = ({ children, isAnimationActive, fill, stroke }: { children?: ReactNode; isAnimationActive?: boolean; fill?: string; stroke?: string }) => (
        <g data-testid="chart-series" data-animated={String(isAnimationActive)} data-color={fill ?? stroke}>{children}</g>
    );
    return {
        ResponsiveContainer: container,
        BarChart: ({ children, layout, data }: { children: ReactNode; layout?: string; data: unknown[] }) => <svg data-testid="bar-chart" data-layout={layout ?? "horizontal"} data-count={data.length}>{children}</svg>,
        LineChart: ({ children, data }: { children: ReactNode; data: unknown[] }) => <svg data-testid="line-chart" data-count={data.length}>{children}</svg>,
        PieChart: ({ children }: { children: ReactNode }) => <svg data-testid="pie-chart">{children}</svg>,
        Pie: ({ children, innerRadius, outerRadius, cy, data, label, isAnimationActive }: { children: ReactNode; innerRadius?: string | number; outerRadius?: string | number; cy?: string | number; data: Array<{ value: number }>; label?: false | ((props: Record<string, unknown>) => ReactNode); isAnimationActive?: boolean }) => <g data-testid="pie" data-animated={String(isAnimationActive)} data-inner-radius={innerRadius} data-outer-radius={outerRadius} data-cy={cy}>{children}{typeof label === "function" && data.map((item, index) => <g data-testid="pie-external-label" key={index}>{label({ index, value: item.value, cx: 100, cy: 100, outerRadius: 100, midAngle: 90 - index * 40 })}</g>)}</g>,
        Bar: series, Line: series, Cell: ({ fill }: { fill: string }) => <i data-testid="pie-cell" data-color={fill} />, Label: ({ value }: { value: string }) => <text>{value}</text>,
        CartesianGrid: () => null, Legend: () => null,
        Tooltip: ({ formatter }: { formatter?: (value: unknown) => string }) => <text data-testid="tooltip-value">{formatter?.(12908199.939999992)}</text>,
        XAxis: ({ tickFormatter }: { tickFormatter?: (value: unknown) => string }) => <text data-testid="x-axis-value">{tickFormatter?.(12908199.939999992)}</text>,
        YAxis: ({ tickFormatter, width }: { tickFormatter?: (value: unknown) => string; width?: number }) => <text data-testid="y-axis-value" data-width={width}>{tickFormatter?.(12908199.939999992)}</text>,
    };
});

const request = { action: "select" as const, source: { table: "Sales" }, fields: ["Category", "Amount"] };
const response = (data: Record<string, unknown>[]) => ({ success: true, message: "ok", data, meta: { page: null, pageSize: null, totalRows: data.length, rowsReturned: data.length, executionTime: 1 } });

describe("modern chart widget", () => {
    beforeEach(() => {
        clearRequestCache();
        Object.values(mocks).forEach(mock => mock.mockReset());
        mocks.exportPng.mockResolvedValue(undefined);
        mocks.exportExcel.mockResolvedValue(undefined);
    });

    it("renders donut totals, horizontal bars, and line charts from existing chart types", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 7 }, { Category: "B", Amount: 3 }]));
        const { rerender } = render(<DashboardProvider><ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType="pie" chartOptions={{ appearance: "donut", showCenterTotal: true }} /></DashboardProvider>);
        expect(await screen.findByTestId("pie")).toBeTruthy();
        expect(screen.getByTestId("pie").getAttribute("data-inner-radius")).toBe("50%");
        expect(screen.getByTestId("pie").getAttribute("data-outer-radius")).toBe("80%");
        expect(screen.getByTestId("pie").getAttribute("data-animated")).toBe("false");
        expect(screen.getByText("10")).toBeTruthy();
        expect(screen.getByText("Total")).toBeTruthy();

        rerender(<DashboardProvider><ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType="bar" chartOptions={{ orientation: "horizontal" }} /></DashboardProvider>);
        expect(await screen.findByTestId("bar-chart")).toBeTruthy();
        expect(screen.getByTestId("bar-chart").getAttribute("data-layout")).toBe("vertical");
        expect(screen.getByTestId("chart-series").getAttribute("data-animated")).toBe("false");

        rerender(<DashboardProvider><ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType="line" chartOptions={{ smooth: true, showPoints: true }} /></DashboardProvider>);
        expect(await screen.findByTestId("line-chart")).toBeTruthy();
        expect(screen.getByTestId("chart-series").getAttribute("data-animated")).toBe("false");
    });

    it("formats donut totals, external labels, tooltips, and horizontal axes", async () => {
        mocks.executeRequest.mockResolvedValue(response([
            { Category: "Large", Amount: 12908199.939999992 },
            { Category: "Medium", Amount: 4235826.41 },
            ...Array.from({ length: 10 }, (_, index) => ({ Category: `Tiny ${index}`, Amount: 1 })),
        ]));
        const view = render(<DashboardProvider><ChartWidget title="Values" request={request} xField="Category" yField="Amount" chartType="pie" showTooltip chartOptions={{ appearance: "donut", showLabels: true, showCenterTotal: true }} /></DashboardProvider>);
        expect(await screen.findByText("17.14M")).toBeTruthy();
        expect(screen.getAllByTestId("pie-external-label").filter(label => label.textContent).length).toBeLessThan(12);
        expect(screen.getByTestId("tooltip-value").textContent).toBe("12,908,199.94");

        view.rerender(<DashboardProvider><ChartWidget title="Values" request={request} xField="Category" yField="Amount" chartType="bar" showTooltip chartOptions={{ orientation: "horizontal" }} /></DashboardProvider>);
        expect((await screen.findByTestId("x-axis-value")).textContent).toBe("12.91M");
        expect(document.querySelector(".dashboard-widget-content__chart-canvas")?.getAttribute("style")).toContain("508px");
        expect(screen.getByTestId("y-axis-value").getAttribute("data-width")).toBe("110");
    });

    it("gives long horizontal categories a readable axis and scrollable dynamic plot", async () => {
        mocks.executeRequest.mockResolvedValue(response(Array.from({ length: 12 }, (_, index) => ({
            Category: `Category with a deliberately long enterprise label ${index + 1}`,
            Amount: index % 2 ? -(index + 1) : index,
        }))));
        render(<DashboardProvider><ChartWidget title="Categories" request={request} xField="Category" yField="Amount" chartType="bar" chartOptions={{ orientation: "horizontal" }} /></DashboardProvider>);

        expect(await screen.findByTestId("bar-chart")).toBeTruthy();
        expect(document.querySelector(".dashboard-widget-content__chart--scrollable")).toBeTruthy();
        expect(document.querySelector(".dashboard-widget-content__chart-canvas")?.getAttribute("style")).toContain("508px");
        expect(screen.getByTestId("y-axis-value").getAttribute("data-width")).toBe("190");
        expect(screen.getByTestId("bar-chart").getAttribute("data-count")).toBe("12");
    });

    it("honors both label flags and center-total visibility", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 1000 }]));
        const view = render(<DashboardProvider><ChartWidget title="Labels" request={request} xField="Category" yField="Amount" chartType="pie" chartOptions={{ appearance: "donut", showLabels: false, showCenterTotal: false }} /></DashboardProvider>);
        await screen.findByTestId("pie");
        expect(screen.queryByTestId("pie-external-label")).toBeNull();
        expect(screen.queryByText("1K")).toBeNull();

        view.rerender(<DashboardProvider><ChartWidget title="Labels" request={request} xField="Category" yField="Amount" chartType="pie" chartOptions={{ appearance: "donut", showDataLabels: true, showCenterTotal: true }} /></DashboardProvider>);
        expect((await screen.findAllByText("1K")).length).toBe(2);
        expect(screen.getByTestId("pie-external-label").textContent).toBe("1K");
    });

    it("explains negative and zero-only pie data without misrepresenting it", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "Loss", Amount: -2 }]));
        const view = render(<DashboardProvider><ChartWidget title="Losses" request={request} xField="Category" yField="Amount" chartType="pie" /></DashboardProvider>);
        expect(await screen.findByText("Pie chart cannot display negative values")).toBeTruthy();
        expect(screen.queryByTestId("pie-chart")).toBeNull();

        mocks.executeRequest.mockResolvedValue(response([{ Category: "None", Amount: 0 }]));
        view.rerender(<DashboardProvider><ChartWidget title="Zero" request={{ ...request, database: "other" }} xField="Category" yField="Amount" chartType="pie" /></DashboardProvider>);
        expect(await screen.findByText("No positive pie values")).toBeTruthy();
    });

    it("exports displayed graphics but complete filtered source rows for tabular formats", async () => {
        mocks.executeRequest.mockResolvedValue(response([
            { Category: "=Formula", Amount: 10 }, { Category: "B", Amount: 8 }, { Category: "C", Amount: -2 },
        ]));
        render(
            <DashboardProvider>
                <ChartWidget title="Sales Chart" request={request} xField="Category" yField="Amount" chartType="bar"
                    chartOptions={{ topN: 1, showOthers: true }}
                    exportConfig={{ enabled: true, formats: ["png", "svg", "csv", "excel"], filename: "sales-chart" }} />
            </DashboardProvider>
        );
        await screen.findByTestId("bar-chart");
        const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Export" }));
        openMenu();
        expect(screen.getByText("Chart Image")).toBeTruthy();
        fireEvent.click(screen.getByRole("menuitem", { name: "Download PNG" }));
        await waitFor(() => expect(mocks.exportPng).toHaveBeenCalledWith(expect.objectContaining({ className: "dashboard-widget-content__chart-canvas" }), "sales-chart.png"));
        openMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: "Download SVG" }));
        expect(mocks.exportSvg).toHaveBeenCalledWith(expect.objectContaining({ className: "dashboard-widget-content__chart-canvas" }), "sales-chart.svg");
        openMenu();
        expect(screen.getByText("Chart Data")).toBeTruthy();
        fireEvent.click(screen.getByRole("menuitem", { name: "Download CSV — complete filtered source" }));
        const completeSource = [
            { Category: "=Formula", Amount: 10 }, { Category: "B", Amount: 8 }, { Category: "C", Amount: -2 },
        ];
        expect(mocks.exportCsv).toHaveBeenCalledWith(completeSource, "sales-chart.csv");
        openMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: "Download Excel — complete filtered source" }));
        await waitFor(() => expect(mocks.exportExcel).toHaveBeenCalledWith(completeSource, "sales-chart.xlsx"));
    });

    it("hides disabled export and surfaces export failures", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 1 }]));
        const view = render(<ToastProvider><DashboardProvider><ChartWidget title="No Export" request={request} xField="Category" yField="Amount" exportConfig={{ enabled: false, formats: ["png"] }} /></DashboardProvider></ToastProvider>);
        await screen.findByTestId("bar-chart");
        expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Customize" })).toBeNull();

        mocks.exportSvg.mockImplementation(() => { throw new Error("SVG failed"); });
        view.rerender(<ToastProvider><DashboardProvider><ChartWidget title="Export" request={request} xField="Category" yField="Amount" exportConfig={{ enabled: true, formats: ["svg"] }} /></DashboardProvider></ToastProvider>);
        fireEvent.click(await screen.findByRole("button", { name: "Export" }));
        fireEvent.click(screen.getByRole("menuitem", { name: "Download SVG" }));
        expect(await screen.findByText("SVG failed")).toBeTruthy();
    });

    it("previews, cancels, saves, and resets administrator chart colors", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 7 }]));
        const onSave = vi.fn().mockResolvedValue({
            dashboardId: "sales", widgetId: "sales-chart", chartType: "bar", revision: "b".repeat(64),
            seriesColors: { Amount: "#ABCDEF" }, categoryColors: {},
        });
        render(
            <ToastProvider><DashboardProvider>
                <ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType="bar"
                    canCustomizeColors onSaveColors={onSave}
                    colorConfiguration={{ dashboardId: "sales", widgetId: "sales-chart", chartType: "bar", revision: "a".repeat(64), seriesColors: { Amount: "#112233" }, categoryColors: {} }} />
            </DashboardProvider></ToastProvider>
        );
        expect((await screen.findByTestId("chart-series")).getAttribute("data-color")).toBe("#112233");

        expect(screen.getByRole("button", { name: "Customize" })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        expect(screen.getByRole("dialog", { name: "Customize Chart Colors" })).toBeTruthy();
        expect(document.querySelector(".chart-color-dialog__fields")).not.toBeNull();
        expect(document.querySelector(".chart-color-dialog__actions")).not.toBeNull();
        const picker = screen.getByLabelText("Amount color");
        fireEvent.change(picker, { target: { value: "#abcdef" } });
        expect(screen.getByTestId("chart-series").getAttribute("data-color")).toBe("#ABCDEF");
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.getByTestId("chart-series").getAttribute("data-color")).toBe("#112233");

        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        fireEvent.change(screen.getByLabelText("Amount color"), { target: { value: "#abcdef" } });
        fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ Amount: "#ABCDEF" }, "a".repeat(64)));
        expect(await screen.findByText("Chart colors saved successfully.")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        fireEvent.click(screen.getByRole("button", { name: "Reset to Default" }));
        fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
        await waitFor(() => expect(onSave).toHaveBeenLastCalledWith({}, "a".repeat(64)));
    });

    it("keeps pie category colors stable when categories appear or disappear", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 7 }, { Category: "B", Amount: 3 }]));
        render(<DashboardProvider><ChartWidget title="Pie" request={request} xField="Category" yField="Amount" chartType="pie" chartOptions={{ categoryColors: { A: "#010203", Missing: "#040506" } }} /></DashboardProvider>);
        const cells = await screen.findAllByTestId("pie-cell");
        expect(cells.map(cell => cell.getAttribute("data-color"))).toEqual(["#010203", "#2f9e8f"]);
    });
});
