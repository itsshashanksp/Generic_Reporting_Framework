import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearRequestCache } from "../../../engine/RequestCache";
import { useDatabaseSelection } from "../useDatabaseSelection";
import { readPageDatabaseSelection, savePageDatabaseSelection } from "../../../engine/DatabaseContext/pageDatabaseSession";

const { executeRequestMock } = vi.hoisted(() => ({ executeRequestMock: vi.fn() }));

vi.mock("../../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../../api/request")>(),
    executeRequest: executeRequestMock,
}));

const databases = [
    { id: "metadata", name: "Metadata default", default: true, enabled: true, available: true },
    { id: "configured", name: "Configured", default: false, enabled: true, available: true },
    { id: "manual", name: "Manual", default: false, enabled: true, available: true },
];

function Probe({ scope = "report", initial = "", enabled = true }: { scope?: string; initial?: string; enabled?: boolean }) {
    const selection = useDatabaseSelection(scope, enabled, initial);
    return <>
        <span data-testid="database">{selection.database}</span>
        <button onClick={() => selection.select("manual")}>Select manual</button>
    </>;
}

describe("useDatabaseSelection initial database", () => {
    beforeEach(() => {
        clearRequestCache();
        sessionStorage.clear();
        executeRequestMock.mockReset().mockResolvedValue({
            success: true,
            message: "OK",
            data: databases,
            meta: { page: null, pageSize: null, totalRows: 3, rowsReturned: 3, executionTime: 1 },
        });
    });

    it("prefers an authorized configured database over the metadata default", async () => {
        render(<Probe initial="configured" />);
        await waitFor(() => expect(screen.getByTestId("database").textContent).toBe("configured"));
    });

    it("lets a manual page choice override the configured database", async () => {
        render(<Probe initial="configured" />);
        await waitFor(() => expect(screen.getByTestId("database").textContent).toBe("configured"));
        fireEvent.click(screen.getByRole("button", { name: "Select manual" }));
        expect(screen.getByTestId("database").textContent).toBe("manual");
    });

    it("restores an authorized choice for the same page during the login session", async () => {
        const first = render(<Probe scope="dashboard:item" initial="configured" />);
        await waitFor(() => expect(screen.getByTestId("database").textContent).toBe("configured"));
        fireEvent.click(screen.getByRole("button", { name: "Select manual" }));
        first.unmount();
        clearRequestCache();

        render(<Probe scope="dashboard:item" initial="configured" />);
        await waitFor(() => expect(screen.getByTestId("database").textContent).toBe("manual"));
    });

    it("does not apply a retained choice while page selection is disabled", async () => {
        const first = render(<Probe scope="dashboard:item" />);
        await waitFor(() => expect(screen.getByTestId("database").textContent).toBe("metadata"));
        fireEvent.click(screen.getByRole("button", { name: "Select manual" }));
        first.unmount();

        render(<Probe scope="dashboard:item" enabled={false} initial="configured" />);
        expect(screen.getByTestId("database").textContent).toBe("");
    });

    it("falls back to metadata and resets the manual choice when scope changes", async () => {
        const view = render(<Probe scope="one" />);
        await waitFor(() => expect(screen.getByTestId("database").textContent).toBe("metadata"));
        fireEvent.click(screen.getByRole("button", { name: "Select manual" }));
        expect(screen.getByTestId("database").textContent).toBe("manual");
        view.rerender(<Probe scope="two" />);
        expect(screen.getByTestId("database").textContent).toBe("metadata");
    });

    it("ignores an unauthorized configured database", async () => {
        render(<Probe initial="unknown" />);
        await waitFor(() => expect(screen.getByTestId("database").textContent).toBe("metadata"));
    });

    it("clears a stored page choice that is no longer authorized", async () => {
        savePageDatabaseSelection("report:orders", "removed");
        render(<Probe scope="report:orders" initial="configured" />);
        await waitFor(() => expect(screen.getByTestId("database").textContent).toBe("configured"));
        await waitFor(() => expect(readPageDatabaseSelection("report:orders")).toBe(""));
    });
});
