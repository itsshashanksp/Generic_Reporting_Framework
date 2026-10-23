/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { validateDashboard } from "../../engine/DashboardValidator";
import { getReportValidationErrors } from "../../engine/ReportDefinitionEngine/validator";
import { loadNavigation } from "../../engine/NavigationEngine";
import { buildWidgetRegistry } from "../../engine/WidgetEngine/widgetLoader";
import contracts from "../../../examples/sql-resource-contracts.json";

const reports = import.meta.glob("../../../examples/{reports,complete/**/reports}/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const dashboards = import.meta.glob("../../../examples/{dashboards,complete/**/dashboards}/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const widgets = import.meta.glob("../../../examples/{widgets,complete/**/widgets}/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const menus = import.meta.glob("../../../examples/{menu,complete/**/menu}.json", { eager: true, import: "default" }) as Record<string, unknown>;

const reportIds = Object.values(reports).flatMap(value => typeof value === "object" && value && "id" in value ? [String(value.id)] : []);
const widgetIds = Object.keys(buildWidgetRegistry(widgets));
const dashboardIds = Object.values(dashboards).flatMap(value => typeof value === "object" && value && "id" in value ? [String(value.id)] : []);

describe("version-controlled example library", () => {
    it("validates every deployable report, dashboard, reusable widget and menu", () => {
        for (const [file, report] of Object.entries(reports)) expect(getReportValidationErrors(report), file).toEqual([]);
        for (const [file, dashboard] of Object.entries(dashboards)) {
            expect(validateDashboard(dashboard, { reportIds, widgetIds }).errors, file).toEqual([]);
        }
        for (const [file, menu] of Object.entries(menus)) {
            expect(() => loadNavigation(menu, { reportIds, dashboardIds }), file).not.toThrow();
        }
        expect(widgetIds.length).toBeGreaterThan(0);
    });

    it("maps every frontend SQL Resource to a backend example outside the live query root", () => {
        const backendRoot = resolve(process.cwd(), "../../Backend");
        for (const [resource, contract] of Object.entries(contracts.resources)) {
            expect(resource).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]*(?:\/[A-Za-z0-9][A-Za-z0-9_-]*)*$/);
            const path = resolve(backendRoot, contract.backendExample);
            expect(existsSync(path), `${resource}: ${path}`).toBe(true);
            const sql = readFileSync(path, "utf8");
            expect(sql).toMatch(/\b(?:SELECT|WITH)\b/i);
            expect(path).not.toContain(`${resolve(backendRoot, "queries")}/`);
            for (const field of contract.outputFields) {
                expect(sql.toLowerCase(), `${resource} output ${field}`).toContain(field.toLowerCase());
            }
        }
    });
});
