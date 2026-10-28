import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import itemReport from "../../../tests/fixtures/runtime-config/reports/item.json";
import { ApiClientError } from "../../api/client";
import { FilterProvider } from "../../engine/FilterContext";
import { GridProvider } from "../../engine/GridContext";
import { loadDefinition } from "../../engine/ReportDefinitionEngine";
import { clearRequestCache } from "../../engine/RequestCache";
import ReportViewer from "../ReportViewer";

type Request = {
    action: string;
    database?: string;
    groupBy?: unknown;
    filters?: unknown[];
    sort?: unknown[];
    pagination?: { page: number; pageSize: number };
};
type GridProps = {
    rows: Record<string, unknown>[];
    serverPagination: { onPageChange: (page: number) => void };
    onSortChange: (sort: { field: string; direction: "ASC" | "DESC" }[]) => void;
};

const { executeRequestMock, exportRowsCSVMock, gridProps, selectableReport } = vi.hoisted(() => ({
    executeRequestMock: vi.fn(),
    exportRowsCSVMock: vi.fn(),
    gridProps: vi.fn<(props: GridProps) => void>(),
    selectableReport: { enabled: true },
}));

vi.mock("../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../api/request")>(),
    executeRequest: executeRequestMock,
}));

vi.mock("../../engine/ExportEngine", async importOriginal => ({
    ...await importOriginal<typeof import("../../engine/ExportEngine")>(),
    exportRowsCSV: exportRowsCSVMock,
}));

// The checked-in Item report with backend-owned database discovery, loaded
// through the real validator and loader.
vi.mock("../../engine/ReportEngine/reportLoader", async importOriginal => {
    const actual = await importOriginal<typeof import("../../engine/ReportEngine/reportLoader")>();
    const switchable = loadDefinition({
        ...itemReport,
        databaseSelection: true,
    });
    // The same report without database switching, whatever the checked-in file enables.
    const { databaseSelection: _ignored, ...plainItem } = itemReport as typeof itemReport & { databaseSelection?: unknown };
    void _ignored;
    const plain = loadDefinition({ ...plainItem, request: { ...plainItem.request, database: "loyal-ibms" } });
    return {
        ...actual,
        getReport: (id: string) => id === "item" ? (selectableReport.enabled ? switchable : plain) : actual.getReport(id),
    };
});

vi.mock("../../components/Grid/GenericGrid", () => ({
    default: (props: GridProps) => {
        gridProps(props);
        return <ul data-testid="report-grid">{props.rows.map((row, index) => <li key={index}>{String(row.Item_Desc)}</li>)}</ul>;
    },
}));

const REGISTRY = [
    { id: "abc", name: "ABC", default: true, enabled: true, available: true, crossDatabaseGroup: "sql01" },
    { id: "abc2", name: "ABC 2", default: false, enabled: true, available: true, crossDatabaseGroup: "sql01" },
    { id: "other", name: "Other", default: false, enabled: true, available: true, crossDatabaseGroup: "sql02" },
];

function envelope(data: Record<string, unknown>[], totalRows = data.length, pagination?: Request["pagination"]) {
    return {
        success: true,
        message: "ok",
        data,
        meta: { page: pagination?.page ?? null, pageSize: pagination?.pageSize ?? null, totalRows, rowsReturned: data.length, executionTime: 1 },
    };
}

/** A backend whose rows name the database they came from. */
function backend({ registry = REGISTRY as unknown[] | Error, override }: { registry?: unknown[] | Error; override?: (request: Request) => unknown } = {}) {
    return vi.fn(async (request: Request) => {
        if (request.action === "metadata.databases") {
            if (registry instanceof Error) throw registry;
            return envelope(registry as Record<string, unknown>[]);
        }
        if (request.groupBy) return envelope([]);
        const overridden = override?.(request);
        if (overridden) return overridden;
        const database = request.database ?? "default";
        return envelope([{ Item_Code: 1, Item_Desc: `${database} item`, Item_MRP: 10 }], 1, request.pagination);
    });
}

const dataRequests = () => executeRequestMock.mock.calls
    .map(call => call[0] as Request)
    .filter(request => request.action === "select" && !request.groupBy);
const lastDataRequest = () => dataRequests().at(-1)!;
const lastGrid = () => gridProps.mock.calls.at(-1)![0];

async function renderReport(expectedRow: string | null = "abc item") {
    const view = render(
        <MemoryRouter initialEntries={["/reports/item"]}>
            <GridProvider>
                <FilterProvider>
                    <Routes>
                        <Route path="/reports/:reportId" element={<ReportViewer />} />
                    </Routes>
                </FilterProvider>
            </GridProvider>
        </MemoryRouter>
    );
    if (expectedRow) await screen.findByText(expectedRow);
    return view;
}

const databaseSelect = () => screen.getByLabelText("Database") as HTMLSelectElement;
const optionLabels = () => [...databaseSelect().options].map(option => [option.value, option.textContent, option.disabled]);

async function switchTo(database: string, expectedRow = `${database} item`) {
    fireEvent.change(databaseSelect(), { target: { value: database } });
    if (expectedRow) await screen.findByText(expectedRow);
}

describe("ReportViewer database selector", () => {
    beforeEach(() => {
        sessionStorage.clear();
        clearRequestCache();
        gridProps.mockClear();
        exportRowsCSVMock.mockReset();
        selectableReport.enabled = true;
    });

    afterEach(() => vi.restoreAllMocks());

    it("starts on the backend default and maps every authorized ID to its display name", async () => {
        executeRequestMock.mockReset().mockImplementation(backend());
        await renderReport();

        expect(lastDataRequest().database).toBe("abc");
        expect(databaseSelect().value).toBe("abc");
        await waitFor(() => expect(optionLabels()).toEqual([
            ["abc", "ABC", false], ["abc2", "ABC 2", false], ["other", "Other", false],
        ]));
        expect(executeRequestMock.mock.calls.filter(call => call[0].action === "metadata.databases")).toHaveLength(1);
    });

    it("reruns the report on the selected database with the same filters and sort, from page 1", async () => {
        executeRequestMock.mockReset().mockImplementation(backend());
        await renderReport();
        act(() => lastGrid().serverPagination.onPageChange(2));
        await waitFor(() => expect(lastDataRequest().pagination?.page).toBe(2));
        fireEvent.change(screen.getByLabelText("Item Description"), { target: { value: "pen" } });
        fireEvent.click(screen.getByRole("button", { name: "Search" }));
        await waitFor(() => expect(lastDataRequest().filters).toHaveLength(1));

        await switchTo("abc2");

        expect(lastDataRequest()).toMatchObject({
            database: "abc2",
            filters: [{ field: "Item_Desc", operator: "LIKE", value: "%pen%" }],
            sort: [{ field: "Item_Code", direction: "ASC" }],
            pagination: { page: 1, pageSize: 10 },
        });
        expect(screen.queryByText("abc item")).toBeNull();
    });

    it("keeps the selected database for refresh, paging, sorting and export-all", async () => {
        executeRequestMock.mockReset().mockImplementation(backend());
        await renderReport();
        await switchTo("abc2");

        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
        await waitFor(() => expect(dataRequests().length).toBe(3));
        act(() => lastGrid().serverPagination.onPageChange(2));
        await waitFor(() => expect(lastDataRequest().pagination?.page).toBe(2));
        act(() => lastGrid().onSortChange([{ field: "Item_MRP", direction: "DESC" }]));
        await waitFor(() => expect(lastDataRequest().sort).toEqual([{ field: "Item_MRP", direction: "DESC" }]));

        fireEvent.click(screen.getAllByRole("button").find(button => button.getAttribute("aria-haspopup") === "menu")!);
        fireEvent.click(screen.getByRole("menuitem", { name: "All rows — CSV" }));
        await waitFor(() => expect(exportRowsCSVMock).toHaveBeenCalledTimes(1));

        expect(dataRequests().slice(1).map(request => request.database)).toEqual(Array(dataRequests().length - 1).fill("abc2"));
        expect(lastDataRequest().pagination).toEqual({ page: 1, pageSize: 1000 });
        expect(exportRowsCSVMock.mock.calls[0][0]).toEqual([{ Item_Code: 1, Item_Desc: "abc2 item", Item_MRP: 10 }]);
    });

    it("never shows one database's cached rows for another", async () => {
        executeRequestMock.mockReset().mockImplementation(backend());
        await renderReport();
        await switchTo("abc2");
        const requestsBefore = dataRequests().length;

        await switchTo("abc");

        // Served from the abc cache entry: no new request, and abc's own rows.
        expect(dataRequests().length).toBe(requestsBefore);
        expect(screen.getByText("abc item")).toBeTruthy();
        expect(screen.queryByText("abc2 item")).toBeNull();
    });

    it("shows the result of the latest switch when an earlier request finishes later", async () => {
        let releaseAbc2: (value: unknown) => void = () => undefined;
        executeRequestMock.mockReset().mockImplementation(backend({
            override: request => request.database === "abc2"
                ? new Promise(resolve => { releaseAbc2 = resolve; })
                : undefined,
        }));
        await renderReport();

        fireEvent.change(databaseSelect(), { target: { value: "abc2" } });
        fireEvent.change(databaseSelect(), { target: { value: "abc" } });
        await act(async () => releaseAbc2(envelope([{ Item_Code: 2, Item_Desc: "abc2 item", Item_MRP: 1 }])));

        expect(databaseSelect().value).toBe("abc");
        expect(screen.getByText("abc item")).toBeTruthy();
        expect(screen.queryByText("abc2 item")).toBeNull();
    });

    it("clears rows from the previous database as soon as the context changes", async () => {
        executeRequestMock.mockReset().mockImplementation(backend({
            override: request => request.database === "abc2" ? new Promise(() => undefined) : undefined,
        }));
        await renderReport();

        fireEvent.change(databaseSelect(), { target: { value: "abc2" } });
        await waitFor(() => expect(lastDataRequest().database).toBe("abc2"));

        expect(screen.queryByText("abc item")).toBeNull();
    });

    it("shows the backend error for a failing database and can switch back", async () => {
        executeRequestMock.mockReset().mockImplementation(backend({
            override: request => request.database === "abc2"
                ? Promise.reject(new ApiClientError("The database is unavailable.", 503, { code: "DATABASE_UNAVAILABLE", details: [] }))
                : undefined,
        }));
        await renderReport();

        await switchTo("abc2", "");
        expect(await screen.findByText("The database is unavailable.")).toBeTruthy();
        expect(databaseSelect().value).toBe("abc2");

        await switchTo("abc");
        expect(screen.queryByText("The database is unavailable.")).toBeNull();
    });

    it.each([
        ["the backend default is authorized and available", REGISTRY.map(entry => ({ ...entry, default: entry.id === "abc2" })), "abc2"],
        ["the backend default is another authorized database", REGISTRY.map(entry => ({ ...entry, default: entry.id === "other" })), "other"],
        ["the backend default is unavailable", [{ ...REGISTRY[0], available: false }, REGISTRY[1]], "abc2"],
        ["the backend default is disabled", [{ ...REGISTRY[0], enabled: false }, REGISTRY[1]], "abc2"],
        ["no entry is marked default", REGISTRY.map(entry => ({ ...entry, default: false })), "abc"],
    ])("selects by the registry when %s", async (_label, registry, expected) => {
        executeRequestMock.mockReset().mockImplementation(backend({ registry }));
        await renderReport(`${expected} item`);

        expect(databaseSelect().value).toBe(expected);
        expect(dataRequests().map(request => request.database)).toEqual([expected]);
    });

    it.each([
        // Nothing else can be chosen, so the dropdown is disabled.
        ["a listed database is unavailable", [REGISTRY[0], { ...REGISTRY[1], available: false }], [["abc", "ABC", false], ["abc2", "ABC 2 (unavailable)", true]], true],
        ["the other database is not registered", [REGISTRY[0]], [["abc", "ABC", false]], true],
    ])("offers only backend-listed, enabled databases when %s", async (_label, registry, expected, selectDisabled) => {
        executeRequestMock.mockReset().mockImplementation(backend({ registry }));
        await renderReport();

        expect(optionLabels()).toEqual(expected);
        expect(databaseSelect().disabled).toBe(selectDisabled);
        expect(lastDataRequest().database).toBe("abc");
    });

    it("requests nothing when no authorized database is enabled and available", async () => {
        executeRequestMock.mockReset().mockImplementation(backend({ registry: [
            { ...REGISTRY[0], available: false }, { ...REGISTRY[2], enabled: false },
        ] }));
        await renderReport(null);

        expect(await screen.findByText("No database available")).toBeTruthy();
        expect(optionLabels()).toEqual([["", "Choose a database", true], ["abc", "ABC (unavailable)", true]]);
        expect(databaseSelect().disabled).toBe(true);
        expect(dataRequests()).toEqual([]);
    });

    it("fails closed with no configured fallback when database discovery is unauthorized", async () => {
        executeRequestMock.mockReset().mockImplementation(backend({ registry: new ApiClientError("Access denied.", 403, { code: "AUTHORIZATION_DENIED", details: [] }) }));
        await renderReport(null);

        expect(await screen.findByText("Database list unavailable")).toBeTruthy();
        expect(screen.getByText("Access denied.")).toBeTruthy();
        expect(optionLabels()).toEqual([["", "Choose a database", true]]);
        expect(dataRequests()).toEqual([]);
    });

    it("fails closed when database metadata is malformed", async () => {
        executeRequestMock.mockReset().mockImplementation(backend({ registry: [
            { id: "abc", default: true, enabled: true, available: true },
        ] }));
        await renderReport(null);

        expect(await screen.findByText("The database list response was invalid.")).toBeTruthy();
        expect(optionLabels()).toEqual([["", "Choose a database", true]]);
        expect(dataRequests()).toEqual([]);
    });

    it("does not retain database metadata after identity cache invalidation", async () => {
        executeRequestMock.mockReset().mockImplementation(backend({ registry: [REGISTRY[0]] }));
        const firstIdentity = await renderReport();
        expect(optionLabels()).toEqual([["abc", "ABC", false]]);
        firstIdentity.unmount();

        // AuthContext invokes this on logout, login, session expiry, and
        // identity changes. The next identity must discover its own list.
        clearRequestCache();
        executeRequestMock.mockReset().mockImplementation(backend({ registry: [{ ...REGISTRY[2], default: true }] }));
        await renderReport("other item");

        expect(optionLabels()).toEqual([["other", "Other", false]]);
        expect(dataRequests().map(request => request.database)).toEqual(["other"]);
    });

    it("retries a failed listing and then resolves the backend default", async () => {
        let refuse = true;
        executeRequestMock.mockReset().mockImplementation(async (request: Request) => {
            if (request.action === "metadata.databases" && refuse) {
                refuse = false;
                throw new ApiClientError("The data service could not be reached.", 0);
            }
            return backend()(request);
        });
        await renderReport(null);
        await screen.findByText("Database list unavailable");

        fireEvent.click(screen.getByRole("button", { name: "Try again" }));

        await screen.findByText("abc item");
        expect(databaseSelect().value).toBe("abc");
    });

    it("ignores a selection outside the offered databases", async () => {
        executeRequestMock.mockReset().mockImplementation(backend());
        await renderReport();
        const before = dataRequests().length;

        fireEvent.change(databaseSelect(), { target: { value: "missing" } });

        expect(dataRequests().length).toBe(before);
        expect(databaseSelect().value).toBe("abc");
    });

    it("renders one selector in the report header and keeps it out of the result toolbar", async () => {
        executeRequestMock.mockReset().mockImplementation(backend());
        await renderReport();
        const toolbar = screen.getByRole("toolbar", { name: "Report actions" });

        expect(within(toolbar).queryByLabelText("Database")).toBeNull();
        expect(databaseSelect().closest(".report-page__header")).not.toBeNull();
        expect(screen.getAllByLabelText("Database")).toHaveLength(1);
    });

    it("leaves reports without databaseSelection unchanged", async () => {
        selectableReport.enabled = false;
        executeRequestMock.mockReset().mockImplementation(backend());
        render(
            <MemoryRouter initialEntries={["/reports/item"]}>
                <GridProvider><FilterProvider><Routes><Route path="/reports/:reportId" element={<ReportViewer />} /></Routes></FilterProvider></GridProvider>
            </MemoryRouter>
        );
        await screen.findByText("loyal-ibms item");

        expect(screen.queryByLabelText("Database")).toBeNull();
        expect(executeRequestMock.mock.calls.some(call => call[0].action === "metadata.databases")).toBe(false);
        expect(lastDataRequest().database).toBe("loyal-ibms");
    });
});
