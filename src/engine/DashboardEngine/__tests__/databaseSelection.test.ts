import { describe, expect, it } from "vitest";

import { validateDashboard } from "../../DashboardValidator";
import { inheritDashboardDatabase, loadDashboardConfiguration } from "..";

const inheriting = {
    id: "total", type: "stat", title: "Total",
    queryDefinition: { format: "sql", resource: "widgets/total-sales" },
};
const pinned = {
    id: "pinned", type: "stat", title: "Pinned",
    queryDefinition: { format: "sql", database: "loyal-ibms", resource: "widgets/total-sales" },
};
const dashboard = (databaseSelection: unknown, widgets: unknown[] = [inheriting]) => ({
    id: "db-dashboard", title: "Database dashboard", databaseSelection, widgets,
});

describe("dashboard databaseSelection validation", () => {
    it("accepts backend-owned discovery", () => {
        expect(validateDashboard(dashboard(true)).errors).toEqual([]);
        expect(loadDashboardConfiguration(dashboard(true)).status).toBe("valid");
    });

    it.each([false, {}, { databases: ["abc", "abc2"] }, ["abc", "abc2"]])("rejects frontend-owned database options: %j", databaseSelection => {
        expect(validateDashboard(dashboard(databaseSelection)).errors).toEqual(["Dashboard databaseSelection must be true."]);
    });

    it("rejects a selector that no widget would follow", () => {
        const result = loadDashboardConfiguration(dashboard(true, [pinned]));
        expect(result.status).toBe("invalid");
        expect(result.validation.errors).toEqual([
            "Dashboard databaseSelection needs at least one visible widget whose request names no database; widgets with their own database never follow the selection.",
        ]);
    });

    it("counts a report-backed widget that names no database as inheriting", () => {
        const reportWidget = { id: "report", type: "report", title: "Items", reportId: "item" };
        expect(loadDashboardConfiguration(dashboard(true, [reportWidget])).status).toBe("valid");
    });

    it("rejects databaseSelection on a widget", () => {
        const errors = validateDashboard(dashboard(undefined, [{ ...inheriting, databaseSelection: true }])).errors;
        expect(errors.some(error => error.includes('unknown property "databaseSelection"'))).toBe(true);
    });
});

describe("inheritDashboardDatabase", () => {
    it("fills only a missing database", () => {
        expect(inheritDashboardDatabase({ action: "sql" }, "abc2")).toEqual({ action: "sql", database: "abc2" });
        expect(inheritDashboardDatabase({ action: "sql", database: "loyal-ibms" }, "abc2")).toEqual({ action: "sql", database: "loyal-ibms" });
        const request = { action: "sql" };
        expect(inheritDashboardDatabase(request, "")).toBe(request);
    });
});
