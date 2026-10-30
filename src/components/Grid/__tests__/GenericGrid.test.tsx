import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GridProvider } from "../../../engine/GridContext";
import { defaultColumn, defaultGridOptions } from "../../../engine/GridEngine";
import { getContentMinWidth } from "../../../engine/GridEngine/contentWidth";
import GenericGrid from "../GenericGrid";

const { agGridProps } = vi.hoisted(() => ({ agGridProps: vi.fn() }));

vi.mock("ag-grid-react", () => ({
    AgGridReact: (props: unknown) => {
        agGridProps(props);
        return <div data-testid="ag-grid" />;
    },
}));

const columns = [
    { field: "Code", header: "Item Code", visible: true, sortable: true, width: 150 },
    { field: "Description", header: "Item Description", visible: true, sortable: true, width: 240 },
];
const gridConfig = {
    pagination: { enabled: true, pageSize: 25, pageSizeOptions: [25, 50] },
    rowSelection: "multiple" as const,
};

describe("GenericGrid shared configuration", () => {
    it("makes retained grid content inert and hidden while its full skeleton is active", () => {
        const { container } = render(
            <GridProvider>
                <GenericGrid rows={[{ Code: "A" }]} columns={columns} gridConfig={gridConfig} busy />
            </GridProvider>,
        );
        const grid = container.querySelector(".universal-grid");
        expect(grid?.getAttribute("aria-hidden")).toBe("true");
        expect(grid?.hasAttribute("inert")).toBe(true);
    });

    beforeEach(() => agGridProps.mockClear());

    it("preserves configured column order and labels", () => {
        render(<GridProvider><GenericGrid rows={[{ Code: "A", Description: "Alpha" }]} columns={columns} gridConfig={gridConfig} /></GridProvider>);
        const props = agGridProps.mock.calls.at(-1)?.[0];
        expect(props.columnDefs.map((column: { field: string }) => column.field)).toEqual(["Code", "Description"]);
        expect(props.columnDefs.map((column: { headerName: string }) => column.headerName)).toEqual(["Item Code", "Item Description"]);
        expect(props.columnDefs.map((column: { initialWidth: number }) => column.initialWidth)).toEqual([150, 240]);
        expect(props.columnDefs.every((column: { minWidth: number }) => column.minWidth >= 150)).toBe(true);
        expect(props.defaultColDef).toMatchObject({ resizable: true, suppressMovable: false });
        expect(props.maintainColumnOrder).toBe(true);
        expect(props.suppressMovableColumns).toBe(false);
        expect(props.rowSelection).toEqual({
            mode: "multiRow",
            checkboxes: false,
            enableClickSelection: true,
            enableSelectionWithoutKeys: false,
            headerCheckbox: false,
        });
        expect(props.columnDefs.every((column: object) => !("dataType" in column) && !("align" in column))).toBe(true);
    });

    it("lets ordinary columns share available width while preserving authored widths", () => {
        render(<GridProvider><GenericGrid rows={[{ Auto: "A", Fixed: "B" }]} columns={[
            { field: "Auto", header: "Automatic", visible: true, sortable: true },
            { field: "Fixed", header: "Fixed", visible: true, sortable: true, width: 220 },
        ]} gridConfig={gridConfig} /></GridProvider>);
        const definitions = agGridProps.mock.calls.at(-1)?.[0].columnDefs;
        expect(definitions[0]).toMatchObject({ flex: 1, initialWidth: undefined });
        expect(definitions[1]).toMatchObject({ flex: undefined, initialWidth: 220 });
    });

    it("initializes AG Grid sort indicators in configured multi-sort order", () => {
        render(
            <GridProvider>
                <GenericGrid
                    rows={[{ Code: "A", Description: "Alpha" }]}
                    columns={columns}
                    gridConfig={gridConfig}
                    initialSort={[
                        { field: "Description", direction: "DESC" },
                        { field: "Code", direction: "ASC" },
                    ]}
                />
            </GridProvider>
        );
        const props = agGridProps.mock.calls.at(-1)?.[0];

        expect(props.columnDefs[0]).toMatchObject({ initialSort: "asc", initialSortIndex: 1 });
        expect(props.columnDefs[1]).toMatchObject({ initialSort: "desc", initialSortIndex: 0 });
        expect((screen.getByLabelText("Sort records by") as HTMLSelectElement).value).toBe("Description");
        expect(screen.getByRole("button", { name: "Sort ascending" })).toBeTruthy();
    });

    it("formats numeric cells without changing row data", () => {
        const rows = [{ Code: 0.30000000000000004, Description: "Calculated" }];
        render(<GridProvider><GenericGrid rows={rows} columns={columns} gridConfig={gridConfig} /></GridProvider>);
        const props = agGridProps.mock.calls.at(-1)?.[0];

        expect(props.columnDefs[0].valueFormatter({ value: rows[0].Code })).toBe("0.3");
        expect(rows[0].Code).toBe(0.30000000000000004);
        expect(screen.getByLabelText("Item Code: 0.3")).toBeTruthy();
    });

    it("formats decimal strings only for explicitly numeric columns", () => {
        const row = {
            CustomerCode: "7019901585",
            MinimumBill: "12509.549999999999",
            MaximumBill: "4208.449999999998",
            AverageBill: "7813.800000000002",
        };
        const numericColumns = [
            { field: "CustomerCode", header: "Customer Code", dataType: "text" as const, visible: true },
            { field: "MinimumBill", header: "Minimum Bill", dataType: "number" as const, visible: true },
            { field: "MaximumBill", header: "Maximum Bill", dataType: "number" as const, visible: true },
            { field: "AverageBill", header: "Average Bill", dataType: "number" as const, visible: true },
        ];
        render(<GridProvider><GenericGrid rows={[row]} columns={numericColumns} gridConfig={gridConfig} /></GridProvider>);
        const props = agGridProps.mock.calls.at(-1)?.[0];

        expect(props.columnDefs[0].valueFormatter({ value: row.CustomerCode })).toBe("7019901585");
        expect(props.columnDefs[1].valueFormatter({ value: row.MinimumBill })).toBe("12,509.55");
        expect(props.columnDefs[2].valueFormatter({ value: row.MaximumBill })).toBe("4,208.45");
        expect(props.columnDefs[3].valueFormatter({ value: row.AverageBill })).toBe("7,813.8");
        expect(row.MinimumBill).toBe("12509.549999999999");
        expect(screen.getByLabelText("Customer Code: 7019901585")).toBeTruthy();
        expect(screen.getByText("12,509.55")).toBeTruthy();
    });

    it("aligns typed numeric values and headers without treating text identifiers as numbers", () => {
        const row = { Code: "00123", Integer: 7, Currency: -1250.5, Percentage: 18 };
        render(<GridProvider><GenericGrid rows={[row]} columns={[
            { field: "Code", header: "Code", dataType: "text", visible: true },
            { field: "Integer", header: "Integer", dataType: "number", visible: true },
            { field: "Currency", header: "Currency", dataType: "currency", visible: true },
            { field: "Percentage", header: "Percentage", dataType: "percentage", visible: true },
        ]} gridConfig={gridConfig} /></GridProvider>);
        const definitions = agGridProps.mock.calls.at(-1)?.[0].columnDefs;

        expect(definitions.map((column: { cellClass: string }) => column.cellClass)).toEqual([
            "universal-grid__cell--left",
            "universal-grid__cell--right",
            "universal-grid__cell--right",
            "universal-grid__cell--right",
        ]);
        expect(definitions.map((column: { headerClass: string }) => column.headerClass)).toEqual([
            "universal-grid__header--left",
            "universal-grid__header--left",
            "universal-grid__header--left",
            "universal-grid__header--left",
        ]);
        expect(definitions[0].valueFormatter({ value: row.Code })).toBe("00123");
        expect(definitions[2].valueFormatter({ value: row.Currency })).toBe("-₹1,250.50");
        expect(definitions[3].valueFormatter({ value: row.Percentage })).toBe("18.00%");
        expect(definitions.map((column: { cellDataType: unknown }) => column.cellDataType)).toEqual([
            "text", "number", "number", "number",
        ]);
    });

    it("uses safe AG Grid cell types for native values and opts SQL strings out of inference", () => {
        render(<GridProvider><GenericGrid rows={[{
            Amount: "12.50",
            Active: true,
            BillDate: "2026-10-30",
            EmptyNumber: null,
        }]} columns={[
            { field: "Amount", header: "Amount", dataType: "number", visible: true },
            { field: "Active", header: "Active", dataType: "boolean", visible: true },
            { field: "BillDate", header: "Bill Date", dataType: "date", visible: true },
            { field: "EmptyNumber", header: "Empty Number", dataType: "number", visible: true },
        ]} gridConfig={{ ...gridConfig, rowSelection: "single" }} /></GridProvider>);
        const props = agGridProps.mock.calls.at(-1)?.[0];

        expect(props.columnDefs.map((column: { cellDataType: unknown }) => column.cellDataType))
            .toEqual([false, "boolean", "dateString", false]);
        expect(props.rowSelection).toEqual({
            mode: "singleRow",
            checkboxes: false,
            enableClickSelection: true,
        });
    });

    it.each([10, 25, 50, 100])("uses natural AG Grid height for a standalone %i-row page", pageSize => {
        const rows = Array.from({ length: pageSize }, (_, index) => ({ Code: `A${index + 1}` }));
        const pageGridConfig = {
            ...gridConfig,
            pagination: { enabled: true, pageSize, pageSizeOptions: [10, 25, 50, 100] },
        };
        const view = render(<GridProvider><GenericGrid rows={rows} columns={columns} gridConfig={pageGridConfig} autoHeight /></GridProvider>);
        expect(agGridProps.mock.calls.at(-1)?.[0].domLayout).toBe("autoHeight");
        expect(agGridProps.mock.calls.at(-1)?.[0].paginationPageSize).toBe(pageSize);

        view.rerender(<GridProvider><GenericGrid rows={rows} columns={columns} gridConfig={pageGridConfig} height={420} /></GridProvider>);
        expect(agGridProps.mock.calls.at(-1)?.[0].domLayout).toBe("normal");
    });

    it("passes the declared column type to the desktop grid comparator", () => {
        const numericColumns = [{ field: "Amount", header: "Amount", dataType: "number" as const, visible: true }];
        render(<GridProvider><GenericGrid rows={[{ Amount: "10" }, { Amount: "2" }]} columns={numericColumns} gridConfig={gridConfig} /></GridProvider>);
        const props = agGridProps.mock.calls.at(-1)?.[0];
        const comparator = props.columnDefs[0].comparator as (left: unknown, right: unknown) => number;

        expect(["10", "2", "1"].sort(comparator)).toEqual(["1", "2", "10"]);
    });

    it("renders null as an em dash without changing other falsy values", () => {
        const rows = [{ Code: null, Description: "" }];
        render(<GridProvider><GenericGrid rows={rows} columns={columns} gridConfig={gridConfig} /></GridProvider>);
        const props = agGridProps.mock.calls.at(-1)?.[0];

        expect(props.columnDefs[0].valueFormatter({ value: rows[0].Code })).toBe("—");
        expect(props.columnDefs[1].valueFormatter({ value: rows[0].Description })).toBe("");
        expect(rows[0].Code).toBeNull();
    });

    it("formats date columns consistently in desktop and mobile presentations", () => {
        const row = { BillDate: "2021-04-01", CreatedAt: "2021-04-01T14:30:45Z", ClosedAt: null };
        const dateColumns = [
            { field: "BillDate", header: "Bill Date", dataType: "date" as const, visible: true },
            { field: "CreatedAt", header: "Created At", dataType: "datetime" as const, visible: true },
            { field: "ClosedAt", header: "Closed At", dataType: "date" as const, visible: true },
        ];
        render(<GridProvider><GenericGrid rows={[row]} columns={dateColumns} gridConfig={gridConfig} /></GridProvider>);
        const props = agGridProps.mock.calls.at(-1)?.[0];

        expect(props.columnDefs[0].valueFormatter({ value: row.BillDate })).toBe("01 Apr 2021");
        expect(props.columnDefs[1].valueFormatter({ value: row.CreatedAt })).toBe("01 Apr 2021, 14:30:45");
        expect(props.columnDefs[2].valueFormatter({ value: row.ClosedAt })).toBe("—");
        expect(screen.getByLabelText("Bill Date: 01 Apr 2021")).toBeTruthy();
        expect(screen.getByText("01 Apr 2021, 14:30:45")).toBeTruthy();
        expect(row.CreatedAt).toBe("2021-04-01T14:30:45Z");

        const measuredValues: string[] = [];
        getContentMinWidth([row], "BillDate", "Bill Date", true, value => {
            measuredValues.push(value);
            return value.length * 8;
        }, "date");
        expect(measuredValues).toContain("01 Apr 2021");
    });

    it("exposes working server pagination controls", () => {
        const onPageChange = vi.fn();
        const onPageSizeChange = vi.fn();
        render(
            <GridProvider>
                <GenericGrid
                    rows={[{ Code: "A" }]}
                    columns={columns}
                    gridConfig={{ ...gridConfig, pagination: { ...gridConfig.pagination, showFirstLast: true } }}
                    serverPagination={{ page: 2, pageSize: 25, totalRows: 100, onPageChange, onPageSizeChange }}
                />
            </GridProvider>
        );
        fireEvent.click(screen.getByLabelText("First page"));
        fireEvent.click(screen.getByLabelText("Previous page"));
        fireEvent.click(screen.getByLabelText("Next page"));
        fireEvent.click(screen.getByLabelText("Last page"));
        fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "50" } });
        expect(onPageChange.mock.calls.map(call => call[0])).toEqual([1, 1, 3, 4]);
        expect(onPageSizeChange).toHaveBeenCalledWith(50);
        expect(screen.getByRole("button", { name: "Page 2" }).getAttribute("aria-current")).toBe("page");
    });

    it("paginates client-side rows in the shared mobile presentation", () => {
        const rows = Array.from({ length: 12 }, (_, index) => ({
            Code: `A${index + 1}`,
            Description: `Item ${index + 1}`,
        }));
        render(
            <GridProvider>
                <GenericGrid
                    rows={rows}
                    columns={columns}
                    gridConfig={{
                        ...gridConfig,
                        pagination: { enabled: true, pageSize: 10, pageSizeOptions: [10, 25] },
                    }}
                />
            </GridProvider>
        );

        const records = screen.getByRole("listbox", { name: "Report records" });
        expect(within(records).getAllByRole("option")).toHaveLength(10);
        fireEvent.click(screen.getByLabelText("Next page"));
        expect(within(records).getAllByRole("option")).toHaveLength(2);
        expect(screen.getByRole("button", { name: "Page 2" }).getAttribute("aria-current")).toBe("page");

        fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "25" } });
        expect(within(records).getAllByRole("option")).toHaveLength(12);
        expect(agGridProps.mock.calls.at(-1)?.[0].paginationPageSize).toBe(25);
    });

    it("defines resizable and movable defaults", () => {
        expect(defaultColumn).toMatchObject({
            initialFlex: 1,
            minWidth: 150,
            resizable: true,
            suppressMovable: false,
        });
        expect(defaultColumn).not.toHaveProperty("flex");
        expect(defaultGridOptions).toMatchObject({
            maintainColumnOrder: true,
            suppressMovableColumns: false,
            suppressDragLeaveHidesColumns: true,
        });
    });

    it("calculates independent content minimums for arbitrary fields", () => {
        const rows = [{
            Code: "A",
            Description: "A description that is much longer than the other values",
            Category: "Tools",
        }];
        const measureText = (value: string) => value.length * 8;

        expect(getContentMinWidth(rows, "Code", "Code", true, measureText)).toBe(150);
        expect(getContentMinWidth(rows, "Category", "Category", true, measureText)).toBe(150);
        expect(getContentMinWidth(rows, "Description", "Description", true, measureText)).toBeGreaterThan(400);
    });

    it("samples large result sets when calculating content widths", () => {
        const measureText = vi.fn((value: string) => value.length * 8);
        const rows = Array.from({ length: 10_000 }, (_, index) => ({ Value: `Row ${index}` }));
        getContentMinWidth(rows, "Value", "Value", true, measureText);
        expect(measureText).toHaveBeenCalledTimes(201);
    });

    it("renders every configured field in the generic mobile record presentation", () => {
        const mobileColumns = [
            ...columns,
            { field: "Active", header: "Active", visible: true, sortable: true, width: 150 },
            { field: "Stock", header: "Stock", visible: true, sortable: true, width: 150 },
        ];
        render(
            <GridProvider>
                <GenericGrid
                    rows={[{ Code: "A1", Description: "Alpha", Active: true, Stock: null, Hidden: "not configured" }]}
                    columns={mobileColumns}
                    gridConfig={gridConfig}
                />
            </GridProvider>
        );

        const record = within(screen.getByRole("listbox", { name: "Report records" })).getByRole("option");
        expect(within(record).getByLabelText("Item Code: A1")).toBeTruthy();
        expect(within(record).getByLabelText("Item Description: Alpha")).toBeTruthy();
        expect(record.textContent).toContain("ActiveYes");
        expect(record.textContent).toContain("Stock—");
        expect(record.textContent).not.toContain("not configured");

        fireEvent.click(record);
        expect(record.getAttribute("aria-selected")).toBe("true");
    });

    it("does not treat an empty string as null in mobile cells", () => {
        render(
            <GridProvider>
                <GenericGrid
                    rows={[{ Code: "", Description: "" }]}
                    columns={columns}
                    gridConfig={gridConfig}
                />
            </GridProvider>
        );

        const record = within(screen.getByRole("listbox", { name: "Report records" })).getByRole("option");
        expect(record.textContent).not.toContain("—");
    });

    it("keeps non-descriptive columns in compact labeled detail rows", () => {
        render(
            <GridProvider>
                <GenericGrid
                    rows={[{ Code: 1, Total: 42 }]}
                    columns={[
                        { field: "Code", header: "Code", visible: true, sortable: true },
                        { field: "Total", header: "Total", visible: true, sortable: true },
                    ]}
                    gridConfig={gridConfig}
                />
            </GridProvider>
        );

        const record = within(screen.getByRole("listbox", { name: "Report records" })).getByRole("option");
        expect(record.querySelector(".mobile-report-record__secondary")).toBeNull();
        expect(record.querySelector(".mobile-report-record__details")?.textContent).toContain("Total42");
    });
});
