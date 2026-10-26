import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearRequestCache } from "../../../engine/RequestCache";
import { useDatabaseSelection } from "../useDatabaseSelection";

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

function Probe({ scope = "report", initial = "" }: { scope?: string; initial?: string }) {
    const selection = useDatabaseSelection(scope, true, initial);
    return <>
        <span data-testid="database">{selection.database}</span>
        <button onClick={() => selection.select("manual")}>Select manual</button>
    </>;
}

describe("useDatabaseSelection initial database", () => {
    beforeEach(() => {
        clearRequestCache();
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
});
