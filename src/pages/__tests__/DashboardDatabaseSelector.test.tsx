import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiClientError } from "../../api/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FilterProvider } from "../../engine/FilterContext";
import { clearRequestCache } from "../../engine/RequestCache";
import Dashboard from "../Dashboard";

type Sent = {
    action: string;
    database?: string;
    resource?: string;
    filters?: { field: string; operator: string; value?: unknown }[];
    sort?: unknown[];
    pagination?: { page: number; pageSize: number };
};
type GridProps = {
    rows: Record<string, unknown>[];
    serverPagination?: { onPageChange: (page: number) => void };
    onSortChange?: (sort: { field: string; direction: "ASC" | "DESC" }[]) => void;
};

const { executeRequestMock, gridProps, exportRowsCSVMock } = vi.hoisted(() => ({
    executeRequestMock: vi.fn(),
    gridProps: vi.fn<(props: GridProps) => void>(),
    exportRowsCSVMock: vi.fn(),
}));

vi.mock("../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../api/request")>(),
    executeRequest: executeRequestMock,
}));

vi.mock("../../engine/ExportEngine", async importOriginal => ({
    ...await importOriginal<typeof import("../../engine/ExportEngine")>(),
    exportRowsCSV: exportRowsCSVMock,
}));

vi.mock("../../components/Grid/GenericGrid", () => ({
    default: (props: GridProps) => {
        gridProps(props);
        return <ul data-testid="table-grid">{props.rows.map((row, index) => <li key={index}>{String(row.Month)}</li>)}</ul>;
    },
}));

// Test-only dashboard through the real loader: two widgets inherit the
// dashboard database, the chart keeps its own.
vi.mock("../../engine/DashboardEngine", async importOriginal => {
    const actual = await importOriginal<typeof import("../../engine/DashboardEngine")>();
    const fixture = {
        id: "database-test",
        title: "Database test",
        databaseSelection: { databases: ["abc", "abc2"] },
        filters: [{ field: "Category", label: "Category", type: "text" }],
        widgets: [
            {
                id: "total", type: "stat", title: "Total", width: 4,
                queryDefinition: { format: "sql", resource: "widgets/total-sales" },
                valueField: "TotalSales", format: "number",
            },
            {
                id: "monthly", type: "table", title: "Monthly", width: 8,
                queryDefinition: { format: "sql", resource: "widgets/sales-month-wise" },
                columns: [{ field: "Month", header: "Month" }, { field: "Sales", header: "Sales", dataType: "number" }],
                sort: [{ field: "Month", direction: "DESC" }],
                export: { enabled: true, formats: ["csv"], exportAll: true, exportCurrentView: false, filename: "monthly" },
            },
            {
                id: "fixed", type: "chart", title: "Fixed", width: 12,
                queryDefinition: { format: "sql", database: "loyal-ibms", resource: "widgets/item-stock-value-by-category" },
                xField: "Category", yField: "StockValue",
            },
        ],
    };
    return {
        ...actual,
        getDashboard: (id: string) => id === fixture.id
            ? actual.loadDashboardConfiguration(fixture, id)
            : actual.getDashboard(id),
    };
});

const REGISTRY = [
    { id: "abc", name: "ABC", default: true, enabled: true, available: true, crossDatabaseGroup: "sql01" },
    { id: "abc2", name: "ABC 2", default: false, enabled: true, available: true, crossDatabaseGroup: "sql01" },
];
const TOTALS: Record<string, number> = { abc: 111, abc2: 222, "loyal-ibms": 999 };

function envelope(data: Record<string, unknown>[], pagination?: Sent["pagination"]) {
    return {
        success: true,
        message: "ok",
        data,
        meta: { page: pagination?.page ?? null, pageSize: pagination?.pageSize ?? null, totalRows: data.length, rowsReturned: data.length, executionTime: 1 },
    };
}

/** Each widget's rows name the database that served them. */
function backend({ registry = REGISTRY as unknown[], override }: { registry?: unknown[]; override?: (request: Sent) => unknown } = {}) {
    return vi.fn(async (request: Sent) => {
        if (request.action === "metadata.databases") return envelope(registry as Record<string, unknown>[]);
        const overridden = override?.(request);
        if (overridden) return overridden;
        const database = request.database ?? "default";
        if (request.resource === "widgets/total-sales") return envelope([{ TotalSales: TOTALS[database] ?? 0 }]);
        if (request.resource === "widgets/sales-month-wise") return envelope([{ Month: `${database}-month`, Sales: 1 }], request.pagination);
        return envelope([{ Category: "A", StockValue: TOTALS[database] ?? 0 }]);
    });
}

const sent = () => executeRequestMock.mock.calls.map(call => call[0] as Sent);
const byResource = (resource: string) => sent().filter(request => request.resource === resource);
const lastFor = (resource: string) => byResource(resource).at(-1)!;
const tableGrid = () => gridProps.mock.calls.at(-1)![0];
const select = () => screen.getByLabelText("Database") as HTMLSelectElement;

async function renderDashboard(id = "database-test") {
    render(<FilterProvider><Dashboard dashboardId={id} /></FilterProvider>);
}

async function switchTo(database: string) {
    fireEvent.change(select(), { target: { value: database } });
    await screen.findByText(`${database}-month`);
}

describe("Dashboard database selector", () => {
    beforeEach(() => {
        clearRequestCache();
        gridProps.mockClear();
        exportRowsCSVMock.mockReset();
    });

    afterEach(() => vi.restoreAllMocks());

    it("starts on the backend default and offers only the dashboard's registered databases", async () => {
        executeRequestMock.mockReset().mockImplementation(backend({ registry: [...REGISTRY, { ...REGISTRY[0], id: "other", name: "Other", default: false }] }));
        await renderDashboard();
        await screen.findByText("abc-month");

        expect(select().value).toBe("abc");
        await waitFor(() => expect([...select().options].map(option => option.textContent)).toEqual(["ABC", "ABC 2"]));
        expect(lastFor("widgets/total-sales").database).toBe("abc");
        expect(lastFor("widgets/sales-month-wise").database).toBe("abc");
        expect(lastFor("widgets/item-stock-value-by-category").database).toBe("loyal-ibms");
        expect(screen.getByText("111")).toBeTruthy();
    });

    it("reruns every inheriting widget on the selected database and leaves a widget's own database alone", async () => {
        executeRequestMock.mockReset().mockImplementation(backend());
        await renderDashboard();
        await screen.findByText("abc-month");
        const fixedRequests = byResource("widgets/item-stock-value-by-category").length;

        await switchTo("abc2");

        expect(screen.getByText("222")).toBeTruthy();
        expect(lastFor("widgets/total-sales").database).toBe("abc2");
        expect(lastFor("widgets/sales-month-wise")).toMatchObject({ database: "abc2", pagination: { page: 1, pageSize: 10 } });
        expect(byResource("widgets/item-stock-value-by-category").length).toBe(fixedRequests);
        expect(lastFor("widgets/item-stock-value-by-category").database).toBe("loyal-ibms");
    });

    it("keeps the selection for refresh, shared filters, table paging, sorting and export-all", async () => {
        executeRequestMock.mockReset().mockImplementation(backend());
        await renderDashboard();
        await screen.findByText("abc-month");
        await switchTo("abc2");
        const before = sent().length;

        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
        await waitFor(() => expect(sent().length).toBe(before + 3));
        expect(sent().slice(before).map(request => [request.resource, request.database]).sort()).toEqual([
            ["widgets/item-stock-value-by-category", "loyal-ibms"],
            ["widgets/sales-month-wise", "abc2"],
            ["widgets/total-sales", "abc2"],
        ]);

        fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Pens" } });
        fireEvent.click(screen.getByRole("button", { name: "Search" }));
        await waitFor(() => expect(lastFor("widgets/total-sales").filters).toEqual([{ field: "Category", operator: "LIKE", value: "%Pens%" }]));
        expect(lastFor("widgets/total-sales").database).toBe("abc2");
        await waitFor(() => expect(lastFor("widgets/sales-month-wise").filters).toHaveLength(1));

        act(() => tableGrid().serverPagination!.onPageChange(2));
        await waitFor(() => expect(lastFor("widgets/sales-month-wise").pagination?.page).toBe(2));
        act(() => tableGrid().onSortChange!([{ field: "Sales", direction: "ASC" }]));
        await waitFor(() => expect(lastFor("widgets/sales-month-wise").sort).toEqual([{ field: "Sales", direction: "ASC" }]));

        fireEvent.click(screen.getAllByRole("button").find(button => button.getAttribute("aria-haspopup") === "menu")!);
        fireEvent.click(screen.getByRole("menuitem", { name: "All rows — CSV" }));
        await waitFor(() => expect(exportRowsCSVMock).toHaveBeenCalledTimes(1));
        expect(lastFor("widgets/sales-month-wise")).toMatchObject({ database: "abc2", pagination: { page: 1, pageSize: 1000 } });
        expect(byResource("widgets/sales-month-wise").filter(request => request.database !== "abc2").map(request => request.database)).toEqual(["abc"]);
    });

    it("never shows one database's cached results for another", async () => {
        executeRequestMock.mockReset().mockImplementation(backend());
        await renderDashboard();
        await screen.findByText("abc-month");
        await switchTo("abc2");
        const before = sent().length;

        await switchTo("abc");

        expect(sent().length).toBe(before);
        expect(screen.getByText("111")).toBeTruthy();
        expect(screen.queryByText("222")).toBeNull();
        expect(screen.queryByText("abc2-month")).toBeNull();
    });

    it("ignores results that arrive after a newer switch", async () => {
        const pending: ((value: unknown) => void)[] = [];
        executeRequestMock.mockReset().mockImplementation(backend({
            override: request => request.database === "abc2"
                ? new Promise(resolve => { pending.push(resolve); })
                : undefined,
        }));
        await renderDashboard();
        await screen.findByText("abc-month");

        fireEvent.change(select(), { target: { value: "abc2" } });
        fireEvent.change(select(), { target: { value: "abc" } });
        await act(async () => {
            pending.forEach(resolve => resolve(envelope([{ TotalSales: 222, Month: "abc2-month", Sales: 1 }])));
        });

        expect(select().value).toBe("abc");
        expect(screen.getByText("111")).toBeTruthy();
        expect(screen.queryByText("222")).toBeNull();
        expect(screen.queryByText("abc2-month")).toBeNull();
    });

    it("stops a running table export when the database changes", async () => {
        let exportSignal: AbortSignal | undefined;
        executeRequestMock.mockReset().mockImplementation(async (request: Sent, options?: { signal?: AbortSignal }) => {
            if (request.pagination?.pageSize === 1000) {
                exportSignal = options?.signal;
                return new Promise(() => undefined);
            }
            return backend()(request);
        });
        await renderDashboard();
        await screen.findByText("abc-month");

        fireEvent.click(screen.getAllByRole("button").find(button => button.getAttribute("aria-haspopup") === "menu")!);
        fireEvent.click(screen.getByRole("menuitem", { name: "All rows — CSV" }));
        await waitFor(() => expect(exportSignal).toBeDefined());

        await switchTo("abc2");

        expect(exportSignal!.aborted).toBe(true);
        expect(exportRowsCSVMock).not.toHaveBeenCalled();
    });

    it.each([
        ["the backend default is the other permitted database", REGISTRY.map(entry => ({ ...entry, default: entry.id === "abc2" })), "abc2"],
        ["the backend default is not permitted", [...REGISTRY.map(entry => ({ ...entry, default: false })), { ...REGISTRY[0], id: "other", default: true }], "abc"],
        ["the backend default is unavailable", [{ ...REGISTRY[0], available: false }, REGISTRY[1]], "abc2"],
    ])("selects by the registry when %s", async (_label, registry, expected) => {
        executeRequestMock.mockReset().mockImplementation(backend({ registry }));
        await renderDashboard();
        await screen.findByText(`${expected}-month`);

        expect(select().value).toBe(expected);
        expect([...new Set([...byResource("widgets/total-sales"), ...byResource("widgets/sales-month-wise")].map(request => request.database))]).toEqual([expected]);
        expect(lastFor("widgets/item-stock-value-by-category").database).toBe("loyal-ibms");
    });

    it("shows an unavailable database without letting it be chosen", async () => {
        executeRequestMock.mockReset().mockImplementation(backend({ registry: [REGISTRY[0], { ...REGISTRY[1], available: false }] }));
        await renderDashboard();
        await screen.findByText("abc-month");

        expect([...select().options].map(option => [option.textContent, option.disabled])).toEqual([["ABC", false], ["ABC 2 (unavailable)", true]]);
        expect(select().disabled).toBe(true);
    });

    it("mounts no widget and sends no data request when no permitted database is usable", async () => {
        executeRequestMock.mockReset().mockImplementation(backend({ registry: [] }));
        await renderDashboard();

        expect(await screen.findByText(/None of this dashboard's databases is registered, enabled and available\./)).toBeTruthy();
        expect(sent().filter(request => request.action === "sql")).toEqual([]);
        expect((screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("waits for an explicit choice when the listing fails, including for pinned widgets", async () => {
        executeRequestMock.mockReset().mockImplementation(async (request: Sent) => {
            if (request.action === "metadata.databases") throw new ApiClientError("Access denied.", 403, { code: "AUTHORIZATION_DENIED", details: [] });
            return backend()(request);
        });
        await renderDashboard();

        expect(await screen.findByText(/The database list could not be loaded: Access denied\. Choose a database above to continue\./)).toBeTruthy();
        expect(sent().filter(request => request.action === "sql")).toEqual([]);

        await switchTo("abc2");
        expect(lastFor("widgets/total-sales").database).toBe("abc2");
        expect(lastFor("widgets/item-stock-value-by-category").database).toBe("loyal-ibms");
    });

    it("leaves dashboards without databaseSelection unchanged", async () => {
        executeRequestMock.mockReset().mockImplementation(backend());
        // The Sales dashboard has no databaseSelection; its widgets name no database.
        await renderDashboard("sales-dashboard");
        await waitFor(() => expect(sent().some(request => request.action === "sql")).toBe(true));

        expect(screen.queryByLabelText("Database")).toBeNull();
        expect(sent().some(request => request.action === "metadata.databases")).toBe(false);
        expect(sent().filter(request => request.action === "sql").every(request => request.database === undefined)).toBe(true);
    });
});
