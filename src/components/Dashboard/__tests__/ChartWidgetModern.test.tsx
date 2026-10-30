import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardProvider } from "../../../engine/DashboardContext";
import { clearRequestCache } from "../../../engine/RequestCache";
import ChartWidget from "../ChartWidget";
import { ToastProvider } from "../../Notifications/ToastProvider";

const mocks = vi.hoisted(() => ({
    executeRequest: vi.fn(), exportPng: vi.fn(), exportSvg: vi.fn(), exportCsv: vi.fn(), exportExcel: vi.fn(),
    responsiveProps: vi.fn(),
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
    const container = (props: { children: ReactNode; onResize?: (width: number, height: number) => void }) => {
        mocks.responsiveProps(props);
        return <div data-testid="responsive-chart">{props.children}</div>;
    };
    const series = ({ children, isAnimationActive, fill, stroke, label }: { children?: ReactNode; isAnimationActive?: boolean; fill?: string; stroke?: string; label?: false | { formatter?: (value: unknown) => string; position?: string } }) => (
        <g data-testid="chart-series" data-animated={String(isAnimationActive)} data-color={fill ?? stroke}
            data-has-label={String(Boolean(label))} data-label-position={label ? label.position : undefined} data-label-value={label ? label.formatter?.(6024000) : undefined}>{children}</g>
    );
    return {
        ResponsiveContainer: container,
        BarChart: ({ children, layout, data, margin }: { children: ReactNode; layout?: string; data: unknown[]; margin?: object }) => <svg data-testid="bar-chart" data-layout={layout ?? "horizontal"} data-count={data.length} data-margin={JSON.stringify(margin)}>{children}</svg>,
        LineChart: ({ children, data, margin }: { children: ReactNode; data: unknown[]; margin?: object }) => <svg data-testid="line-chart" data-count={data.length} data-margin={JSON.stringify(margin)}>{children}</svg>,
        AreaChart: ({ children, data, margin }: { children: ReactNode; data: unknown[]; margin?: object }) => <svg data-testid="area-chart" data-count={data.length} data-margin={JSON.stringify(margin)}>{children}</svg>,
        FunnelChart: ({ children }: { children: ReactNode }) => <svg data-testid="funnel-chart">{children}</svg>,
        RadialBarChart: ({ children, data }: { children: ReactNode; data: unknown[] }) => <svg data-testid="radial-bar-chart" data-count={data.length}>{children}</svg>,
        PieChart: ({ children }: { children: ReactNode }) => <svg data-testid="pie-chart">{children}</svg>,
        Pie: ({ children, innerRadius, outerRadius, cy, data, label, isAnimationActive }: { children: ReactNode; innerRadius?: string | number; outerRadius?: string | number; cy?: string | number; data: Array<{ name: string; value: number }>; label?: false | ((props: Record<string, unknown>) => ReactNode); isAnimationActive?: boolean }) => <g data-testid="pie" data-animated={String(isAnimationActive)} data-inner-radius={innerRadius} data-outer-radius={outerRadius} data-cy={cy}>{children}{typeof label === "function" && data.map((item, index) => <g data-testid="pie-external-label" key={index}>{label({ index, name: item.name, value: item.value, cx: 100, cy: 100, outerRadius: 100, midAngle: 90 - index * 40 })}</g>)}</g>,
        Bar: series, Line: series, Area: series, Funnel: series, RadialBar: series,
        Treemap: ({ children, data }: { children: ReactNode; data: unknown[] }) => <svg data-testid="treemap-chart" data-count={data.length}>{children}</svg>,
        Cell: ({ fill }: { fill: string }) => <i data-testid="pie-cell" data-color={fill} />, Label: ({ value }: { value: string }) => <text>{value}</text>, LabelList: () => null,
        CartesianGrid: () => null, Legend: () => <g data-testid="chart-legend" />,
        Tooltip: ({ formatter }: { formatter?: (value: unknown) => string }) => <text data-testid="tooltip-value">{formatter?.(12908199.939999992)}</text>,
        XAxis: ({ tickFormatter, domain, padding }: { tickFormatter?: (value: unknown) => string; domain?: [number, number]; padding?: object }) => <text data-testid="x-axis-value" data-domain={JSON.stringify(domain)} data-padding={JSON.stringify(padding)}>{tickFormatter?.(12908199.939999992)}</text>,
        YAxis: ({ tickFormatter, width, domain }: { tickFormatter?: (value: unknown) => string; width?: number; domain?: [number, number] }) => <text data-testid="y-axis-value" data-width={width} data-domain={JSON.stringify(domain)}>{tickFormatter?.(12908199.939999992)}</text>,
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
        expect(screen.getByTestId("pie").getAttribute("data-inner-radius")).toBe("52%");
        expect(screen.getByTestId("pie").getAttribute("data-outer-radius")).toBe("64%");
        expect(screen.getAllByTestId("pie-external-label").filter(label => label.textContent)).toHaveLength(2);
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

    it("shows shared formatted values by default for Column and Bar while respecting explicit overrides", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "Loss", Amount: -50 }, { Category: "High", Amount: 100 }]));
        const view = render(<DashboardProvider><ChartWidget title="Comparison" request={request} xField="Category" yField="Amount" chartType="bar" /></DashboardProvider>);

        expect(await screen.findByTestId("bar-chart")).toBeTruthy();
        expect(screen.getByTestId("chart-series").getAttribute("data-has-label")).toBe("true");
        expect(screen.getByTestId("chart-series").getAttribute("data-label-position")).toBe("top");
        expect(screen.getByTestId("chart-series").getAttribute("data-label-value")).toBe("60.24 L");
        expect(screen.getByTestId("bar-chart").getAttribute("data-margin")).toContain('"top":28');
        expect(screen.getByTestId("x-axis-value").getAttribute("data-padding")).toBe('{"left":24,"right":24}');
        expect(screen.getByTestId("y-axis-value").getAttribute("data-domain")).toBe("[-68,118]");

        view.rerender(<DashboardProvider><ChartWidget title="Comparison" request={request} xField="Category" yField="Amount" chartType="bar" chartOptions={{ orientation: "horizontal" }} /></DashboardProvider>);
        expect((await screen.findByTestId("chart-series")).getAttribute("data-label-position")).toBe("right");
        expect(screen.getByTestId("bar-chart").getAttribute("data-margin")).toContain('"right":35');
        expect(screen.getByTestId("x-axis-value").getAttribute("data-domain")).toBe("[-68,118]");

        view.rerender(<DashboardProvider><ChartWidget title="Comparison" request={request} xField="Category" yField="Amount" chartType="bar" chartOptions={{ showLabels: false }} /></DashboardProvider>);
        expect((await screen.findByTestId("chart-series")).getAttribute("data-has-label")).toBe("false");
        expect(screen.getByTestId("bar-chart").getAttribute("data-margin")).toContain('"top":12');
    });

    it("uses direct labels for readable trend datasets and the persistent accessible summary for dense trends", async () => {
        mocks.executeRequest.mockResolvedValue(response(Array.from({ length: 9 }, (_, index) => ({ Category: `Point ${index + 1}`, Amount: index }))));
        const view = render(<DashboardProvider><ChartWidget title="Trend" request={request} xField="Category" yField="Amount" chartType="line" /></DashboardProvider>);
        expect((await screen.findByTestId("chart-series")).getAttribute("data-has-label")).toBe("false");
        expect(screen.getByRole("img", { name: /Point 1: 0.*Point 9: 8/ })).toBeTruthy();

        mocks.executeRequest.mockResolvedValue(response([{ Category: "Start", Amount: 0 }, { Category: "End", Amount: 10 }]));
        view.rerender(<DashboardProvider><ChartWidget title="Trend" request={{ ...request, database: "short" }} xField="Category" yField="Amount" chartType="area" /></DashboardProvider>);
        expect((await screen.findByTestId("chart-series")).getAttribute("data-has-label")).toBe("true");
    });

    it.each([
        ["area", "area-chart"],
        ["treemap", "treemap-chart"],
        ["doughnut", "pie"],
        ["radial-bar", "radial-bar-chart"],
    ] as const)("renders the %s chart using the existing category/value mapping", async (chartType, testId) => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 7 }, { Category: "B", Amount: 3 }]));
        render(<DashboardProvider><ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType={chartType} /></DashboardProvider>);
        expect(await screen.findByTestId(testId)).toBeTruthy();
    });

    it("uses the same default labels and proportional tooltip contract for Pie and Doughnut", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 7 }, { Category: "B", Amount: 3 }]));
        const view = render(<DashboardProvider><ChartWidget title="Share" request={request} xField="Category" yField="Amount" chartType="pie" /></DashboardProvider>);
        expect((await screen.findAllByTestId("pie-external-label")).filter(label => label.textContent).map(label => label.textContent)).toEqual(["A: 7", "B: 3"]);
        expect(screen.getByTestId("tooltip-value").textContent).toContain("%");
        expect(screen.getByTestId("chart-legend")).toBeTruthy();
        expect(screen.getByRole("img", { name: /A: 7 \(70%\).*B: 3 \(30%\)/ })).toBeTruthy();

        view.rerender(<DashboardProvider><ChartWidget title="Share" request={request} xField="Category" yField="Amount" chartType="doughnut" /></DashboardProvider>);
        expect((await screen.findAllByTestId("pie-external-label")).filter(label => label.textContent).map(label => label.textContent)).toEqual(["A: 7", "B: 3"]);
        expect(screen.getByTestId("tooltip-value").textContent).toContain("%");
        expect(screen.getByTestId("chart-legend")).toBeTruthy();

        view.rerender(<DashboardProvider><ChartWidget title="Share" request={request} xField="Category" yField="Amount" chartType="doughnut" chartOptions={{ showLegend: false }} /></DashboardProvider>);
        expect(await screen.findByTestId("pie")).toBeTruthy();
        expect(screen.queryByTestId("chart-legend")).toBeNull();
    });

    it("adapts proportional labels to container resize while preserving category identification", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A very long category", Amount: 7 }, { Category: "B", Amount: 3 }]));
        render(<DashboardProvider><ChartWidget title="Share" request={request} xField="Category" yField="Amount" chartType="pie" /></DashboardProvider>);
        expect((await screen.findAllByTestId("pie-external-label")).filter(label => label.textContent)).toHaveLength(2);

        const resize = mocks.responsiveProps.mock.calls.at(-1)?.[0].onResize as (width: number, height: number) => void;
        act(() => resize(320, 240));
        expect(screen.queryByTestId("pie-external-label")).toBeNull();
        expect(screen.getByTestId("chart-legend")).toBeTruthy();
        expect(screen.getByRole("img", { name: /A very long category: 7 \(70%\)/ })).toBeTruthy();

        const resizedAgain = mocks.responsiveProps.mock.calls.at(-1)?.[0].onResize as (width: number, height: number) => void;
        act(() => resizedAgain(640, 320));
        expect((await screen.findAllByTestId("pie-external-label")).filter(label => label.textContent)).toHaveLength(2);
    });

    it("fails safely for legacy Funnel while preserving source-data export", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "Lead", Amount: 7 }]));
        render(<DashboardProvider><ChartWidget title="Legacy" request={request} xField="Category" yField="Amount" chartType="funnel" exportConfig={{ enabled: true, formats: ["png", "csv"] }} /></DashboardProvider>);
        expect(await screen.findByText("Legacy Funnel chart is unsupported")).toBeTruthy();
        expect(screen.queryByTestId("funnel-chart")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        expect((screen.getByRole("menuitem", { name: "Download PNG" }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole("menuitem", { name: "Download CSV" }));
        await waitFor(() => expect(mocks.exportCsv).toHaveBeenCalledWith([{ Category: "Lead", Amount: 7 }], "legacy.csv"));
    });

    it("formats donut totals, external labels, tooltips, and horizontal axes", async () => {
        mocks.executeRequest.mockResolvedValue(response([
            { Category: "Large", Amount: 12908199.939999992 },
            { Category: "Medium", Amount: 4235826.41 },
            ...Array.from({ length: 10 }, (_, index) => ({ Category: `Tiny ${index}`, Amount: 1 })),
        ]));
        const view = render(<DashboardProvider><ChartWidget title="Values" request={request} xField="Category" yField="Amount" chartType="pie" showTooltip chartOptions={{ appearance: "donut", showLabels: true, showCenterTotal: true }} /></DashboardProvider>);
        expect(await screen.findByText("1.71 Cr")).toBeTruthy();
        expect(screen.getAllByTestId("pie-external-label").filter(label => label.textContent).length).toBeLessThan(12);
        expect(screen.getByTestId("tooltip-value").textContent).toContain("1,29,08,199.94");

        view.rerender(<DashboardProvider><ChartWidget title="Values" request={request} xField="Category" yField="Amount" chartType="bar" showTooltip chartOptions={{ orientation: "horizontal" }} /></DashboardProvider>);
        expect((await screen.findByTestId("x-axis-value")).textContent).toBe("1.29 Cr");
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

    it("uses horizontal overflow for dense cartesian charts but adaptive fit for proportional charts", async () => {
        mocks.executeRequest.mockResolvedValue(response(Array.from({ length: 12 }, (_, index) => ({
            Category: `Long enterprise category ${index + 1}`,
            Amount: index + 1,
        }))));
        const view = render(<DashboardProvider><ChartWidget title="Categories" request={request} xField="Category" yField="Amount" chartType="bar" /></DashboardProvider>);

        expect(await screen.findByTestId("bar-chart")).toBeTruthy();
        expect(document.querySelector(".chart-presentation--overflow-horizontal")).not.toBeNull();
        expect(document.querySelector(".dashboard-widget-content__chart-canvas")?.getAttribute("style")).toContain("max(100%");

        view.rerender(<DashboardProvider><ChartWidget title="Categories" request={request} xField="Category" yField="Amount" chartType="pie" /></DashboardProvider>);
        expect(await screen.findByTestId("pie")).toBeTruthy();
        expect(document.querySelector(".chart-presentation--overflow-none")).not.toBeNull();
        expect(document.querySelector(".dashboard-widget-content__chart-canvas")?.getAttribute("style") ?? "").not.toContain("max(100%");
    });

    it("honors both label flags and center-total visibility", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 1000 }]));
        const view = render(<DashboardProvider><ChartWidget title="Labels" request={request} xField="Category" yField="Amount" chartType="pie" chartOptions={{ appearance: "donut", showLabels: false, showCenterTotal: false }} /></DashboardProvider>);
        await screen.findByTestId("pie");
        expect(screen.queryByTestId("pie-external-label")).toBeNull();
        expect(screen.queryByText("1 K")).toBeNull();

        view.rerender(<DashboardProvider><ChartWidget title="Labels" request={request} xField="Category" yField="Amount" chartType="pie" chartOptions={{ appearance: "donut", showDataLabels: true, showCenterTotal: true }} /></DashboardProvider>);
        expect(await screen.findByText("1 K")).toBeTruthy();
        expect(screen.getByTestId("pie-external-label").textContent).toBe("A: 1 K");
    });

    it("explains negative and zero-only pie data without misrepresenting it", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "Loss", Amount: -2 }]));
        const view = render(<DashboardProvider><ChartWidget title="Losses" request={request} xField="Category" yField="Amount" chartType="pie" /></DashboardProvider>);
        expect(await screen.findByText("Pie cannot display negative values")).toBeTruthy();
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
        await waitFor(() => expect(mocks.exportExcel).toHaveBeenCalledWith(completeSource, "sales-chart.xlsx", [
            { field: "Category", header: "Category", dataType: "text" },
            { field: "Amount", header: "Amount", dataType: "number" },
        ]));
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
                    canCustomizeColors onSaveConfiguration={onSave}
                    colorConfiguration={{ dashboardId: "sales", widgetId: "sales-chart", chartType: "bar", revision: "a".repeat(64), seriesColors: { Amount: "#112233" }, categoryColors: {} }} />
            </DashboardProvider></ToastProvider>
        );
        expect((await screen.findByTestId("chart-series")).getAttribute("data-color")).toBe("#112233");

        expect(screen.getByRole("button", { name: "Customize" })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        expect(screen.getByRole("dialog", { name: "Customize Chart" })).toBeTruthy();
        expect(document.querySelector(".chart-color-dialog__fields")).not.toBeNull();
        expect(document.querySelector(".chart-color-dialog__actions")).not.toBeNull();
        expect(document.querySelector(".app-dialog__body > .chart-color-dialog__actions")).toBeNull();
        expect(document.querySelector(".app-dialog__surface > .chart-color-dialog__actions")).not.toBeNull();
        const picker = screen.getByLabelText("Amount color");
        fireEvent.change(picker, { target: { value: "#abcdef" } });
        expect(document.querySelector(".chart-color-dialog__preview [data-testid='chart-series']")?.getAttribute("data-color")).toBe("#ABCDEF");
        expect(screen.getAllByTestId("chart-series")[0].getAttribute("data-color")).toBe("#112233");
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.getByTestId("chart-series").getAttribute("data-color")).toBe("#112233");

        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        fireEvent.change(screen.getByLabelText("Amount color"), { target: { value: "#abcdef" } });
        fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ chartType: "bar", orientation: "vertical", seriesColors: { Amount: "#ABCDEF" }, categoryColors: {} }, "a".repeat(64)));
        expect(await screen.findByText("Chart customization saved successfully.")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        fireEvent.click(screen.getByRole("button", { name: "Reset to Default" }));
        fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
        await waitFor(() => expect(onSave).toHaveBeenLastCalledWith(null, "a".repeat(64)));
    });

    it("previews a compatible chart type without refetching and saves it with both color maps", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 7 }]));
        const onSave = vi.fn().mockResolvedValue({});
        render(<ToastProvider><DashboardProvider><ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType="bar"
            canCustomizeColors onSaveConfiguration={onSave}
            colorConfiguration={{ dashboardId: "sales", widgetId: "sales-chart", chartType: "bar", revision: "a".repeat(64), seriesColors: {}, categoryColors: {} }} />
        </DashboardProvider></ToastProvider>);
        await screen.findByTestId("bar-chart");
        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        fireEvent.click(screen.getByRole("button", { name: "Line" }));
        expect(screen.getByTestId("line-chart")).toBeTruthy();
        expect(mocks.executeRequest).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ chartType: "line", seriesColors: {}, categoryColors: {} }, "a".repeat(64)));
    });

    it("switches shared preview geometry and presentation immediately without retaining stale type state", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 7 }, { Category: "B", Amount: 3 }]));
        render(<ToastProvider><DashboardProvider><ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType="bar"
            canCustomizeColors onSaveConfiguration={vi.fn().mockResolvedValue({})}
            colorConfiguration={{ dashboardId: "sales", widgetId: "sales-chart", chartType: "bar", revision: "a".repeat(64), seriesColors: {}, categoryColors: {} }} />
        </DashboardProvider></ToastProvider>);
        await screen.findByTestId("bar-chart");
        fireEvent.click(screen.getByRole("button", { name: "Customize" }));

        fireEvent.click(screen.getByRole("button", { name: "Pie" }));
        let preview = document.querySelector(".chart-color-dialog__preview");
        expect(preview?.querySelector("[data-testid='pie']")?.getAttribute("data-inner-radius")).toBe("0");
        expect(preview?.textContent).toContain("A: 7");
        expect(preview?.querySelector("[data-testid='chart-legend']")).not.toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Doughnut" }));
        preview = document.querySelector(".chart-color-dialog__preview");
        expect(preview?.querySelector("[data-testid='pie']")?.getAttribute("data-inner-radius")).toBe("52%");

        fireEvent.click(screen.getByRole("button", { name: "Pie" }));
        expect(preview?.querySelector("[data-testid='pie']")?.getAttribute("data-inner-radius")).toBe("0");
        fireEvent.click(screen.getByRole("button", { name: "Column" }));
        expect(preview?.querySelector("[data-testid='bar-chart']")?.getAttribute("data-layout")).toBe("horizontal");
        fireEvent.click(screen.getByRole("button", { name: "Bar" }));
        expect(preview?.querySelector("[data-testid='bar-chart']")?.getAttribute("data-layout")).toBe("vertical");
        fireEvent.click(screen.getByRole("button", { name: "Line" }));
        expect(preview?.querySelector("[data-testid='line-chart']")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Area" }));
        expect(preview?.querySelector("[data-testid='area-chart']")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Treemap" }));
        expect(preview?.querySelector("[data-testid='treemap-chart']")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Radial Bar" }));
        expect(preview?.querySelector("[data-testid='radial-bar-chart']")).not.toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        expect(document.querySelector(".chart-color-dialog__preview [data-testid='bar-chart']")).not.toBeNull();
    });

    it("renders persisted Pie and Doughnut geometry distinctly across reload-style updates", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 7 }, { Category: "B", Amount: 3 }]));
        const baseConfiguration = { dashboardId: "sales", widgetId: "sales-chart", revision: "a".repeat(64), seriesColors: {}, categoryColors: {}, customized: true } as const;
        const view = render(<DashboardProvider><ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType="pie" chartOptions={{ appearance: "donut" }} colorConfiguration={{ ...baseConfiguration, chartType: "pie" }} /></DashboardProvider>);
        expect((await screen.findByTestId("pie")).getAttribute("data-inner-radius")).toBe("0");

        view.rerender(<DashboardProvider><ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType="pie" chartOptions={{ appearance: "donut" }} colorConfiguration={{ ...baseConfiguration, chartType: "doughnut" }} /></DashboardProvider>);
        expect((await screen.findByTestId("pie")).getAttribute("data-inner-radius")).toBe("52%");

        view.rerender(<DashboardProvider><ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType="pie" chartOptions={{ appearance: "donut" }} colorConfiguration={{ ...baseConfiguration, chartType: "pie" }} /></DashboardProvider>);
        expect((await screen.findByTestId("pie")).getAttribute("data-inner-radius")).toBe("0");
    });

    it("exposes deterministic Column and Bar choices and persists the previewed orientation", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 7 }]));
        const onSave = vi.fn().mockResolvedValue({});
        render(<ToastProvider><DashboardProvider><ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType="bar"
            canCustomizeColors onSaveConfiguration={onSave}
            colorConfiguration={{ dashboardId: "sales", widgetId: "sales-chart", chartType: "bar", orientation: "vertical", revision: "a".repeat(64), seriesColors: {}, categoryColors: {} }} />
        </DashboardProvider></ToastProvider>);
        await screen.findByTestId("bar-chart");
        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        expect(screen.getByRole("button", { name: "Column" }).getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(screen.getByRole("button", { name: "Bar" }));
        expect(document.querySelector(".chart-color-dialog__preview [data-testid='bar-chart']")?.getAttribute("data-layout")).toBe("vertical");
        fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ chartType: "bar", orientation: "horizontal", seriesColors: {}, categoryColors: {} }, "a".repeat(64)));
    });

    it("disables incompatible pie customization for signed data", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "Loss", Amount: -7 }]));
        render(<ToastProvider><DashboardProvider><ChartWidget title="Losses" request={request} xField="Category" yField="Amount" chartType="bar"
            canCustomizeColors onSaveConfiguration={vi.fn()}
            colorConfiguration={{ dashboardId: "sales", widgetId: "loss-chart", chartType: "bar", revision: "a".repeat(64), seriesColors: {}, categoryColors: {} }} />
        </DashboardProvider></ToastProvider>);
        await screen.findByTestId("bar-chart");
        fireEvent.click(screen.getByRole("button", { name: "Customize" }));
        const pie = screen.getByRole("button", { name: "Pie" }) as HTMLButtonElement;
        expect(pie.disabled).toBe(true);
        expect(pie.title).toContain("negative values");
    });

    it("keeps pie category colors stable when categories appear or disappear", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 7 }, { Category: "B", Amount: 3 }]));
        render(<DashboardProvider><ChartWidget title="Pie" request={request} xField="Category" yField="Amount" chartType="pie" chartOptions={{ categoryColors: { A: "#010203", Missing: "#040506" } }} /></DashboardProvider>);
        const cells = await screen.findAllByTestId("pie-cell");
        expect(cells.map(cell => cell.getAttribute("data-color"))).toEqual(["#010203", "#2f9e8f"]);
    });
});
