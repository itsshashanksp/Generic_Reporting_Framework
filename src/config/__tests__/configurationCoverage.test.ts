import { describe, expect, it } from "vitest";

import { configurationFeatureRegistry } from "../featureRegistry";
import { validateDashboard } from "../../engine/DashboardValidator";
import { loadNavigation } from "../../engine/NavigationEngine";
import { getReportValidationErrors } from "../../engine/ReportDefinitionEngine/validator";
import { buildWidgetRegistry } from "../../engine/WidgetEngine/widgetLoader";

const reports = import.meta.glob("../../../examples/reports/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const dashboards = import.meta.glob("../../../examples/dashboards/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const widgets = import.meta.glob("../../../examples/widgets/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const menus = import.meta.glob("../../../examples/menu.json", { eager: true, import: "default" }) as Record<string, unknown>;
const documentation = import.meta.glob("../../../docs/*.md", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
// Absolute project paths intentionally bypass the test alias so ignored local
// deployment JSON is covered by config:audit as well as tracked fixtures.
const runtimeReports = import.meta.glob("/src/config/reports/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const runtimeDashboards = import.meta.glob("/src/config/dashboards/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const runtimeMenus = import.meta.glob("/src/config/menu.json", { eager: true, import: "default" }) as Record<string, unknown>;

const examplePaths = new Set([
    ...Object.keys(reports).map(path => path.replace("../../../examples/", "")),
    ...Object.keys(dashboards).map(path => path.replace("../../../examples/", "")),
    ...Object.keys(widgets).map(path => path.replace("../../../examples/", "")),
    ...Object.keys(menus).map(path => path.replace("../../../examples/", "")),
]);
const documentationPaths = new Set(Object.keys(documentation).map(path => path.replace("../../../docs/", "")));
const reportIds = Object.values(reports).flatMap(value => typeof value === "object" && value && "id" in value ? [String(value.id)] : []);
const dashboardIds = Object.values(dashboards).flatMap(value => typeof value === "object" && value && "id" in value ? [String(value.id)] : []);
const widgetIds = Object.keys(buildWidgetRegistry(widgets));

describe("configuration coverage report", () => {
    it("PASS — feature registry entries are complete and uniquely identified", () => {
        expect(configurationFeatureRegistry.length).toBeGreaterThanOrEqual(15);
        expect(new Set(configurationFeatureRegistry.map(feature => feature.id)).size).toBe(configurationFeatureRegistry.length);
        for (const feature of configurationFeatureRegistry) {
            expect(feature.name, feature.id).not.toBe("");
            expect(feature.description, feature.id).not.toBe("");
            expect(feature.componentTypes.length, feature.id).toBeGreaterThan(0);
            expect(feature.properties.length, feature.id).toBeGreaterThan(0);
            expect(feature.validationRules.length, feature.id).toBeGreaterThan(0);
            expect(feature.examples.length, feature.id).toBeGreaterThan(0);
            expect(feature.documentation.length, feature.id).toBeGreaterThan(0);
        }
    });

    it("PASS — every registered feature references real examples and documentation", () => {
        for (const feature of configurationFeatureRegistry) {
            for (const example of feature.examples) expect(examplePaths.has(example), `${feature.id}: ${example}`).toBe(true);
            for (const document of feature.documentation) expect(documentationPaths.has(document), `${feature.id}: ${document}`).toBe(true);
        }
    });

    it("PASS — every public example is owned by at least one registered feature", () => {
        const registered = new Set(configurationFeatureRegistry.flatMap(feature => feature.examples));
        for (const example of examplePaths) expect(registered.has(example), example).toBe(true);
    });

    it("PASS — report, dashboard, widget and navigation examples pass their runtime contracts", () => {
        for (const [path, report] of Object.entries(reports)) expect(getReportValidationErrors(report), path).toEqual([]);
        for (const [path, dashboard] of Object.entries(dashboards)) {
            expect(validateDashboard(dashboard, { reportIds, widgetIds }).errors, path).toEqual([]);
        }
        for (const [path, menu] of Object.entries(menus)) {
            expect(() => loadNavigation(menu, { reportIds, dashboardIds }), path).not.toThrow();
        }
        expect(widgetIds.length).toBeGreaterThan(0);
    });

    it("PASS — canonical registry documents every intentionally deprecated property", () => {
        const deprecated = configurationFeatureRegistry.flatMap(feature => feature.deprecatedProperties);
        expect(deprecated).toContain("databaseSelection");
        expect(new Set(deprecated).size).toBe(deprecated.length);
    });

    it("PASS — ignored local runtime configurations and menu pass their real validators", () => {
        const localReportIds = Object.values(runtimeReports).flatMap(value => typeof value === "object" && value && "id" in value ? [String(value.id)] : []);
        const localDashboardIds = Object.values(runtimeDashboards).flatMap(value => typeof value === "object" && value && "id" in value ? [String(value.id)] : []);
        for (const [path, report] of Object.entries(runtimeReports)) expect(getReportValidationErrors(report), path).toEqual([]);
        for (const [path, dashboard] of Object.entries(runtimeDashboards)) {
            expect(validateDashboard(dashboard, { reportIds: localReportIds, widgetIds }).errors, path).toEqual([]);
        }
        for (const [path, menu] of Object.entries(runtimeMenus)) {
            expect(() => loadNavigation(menu, { reportIds: localReportIds, dashboardIds: localDashboardIds }), path).not.toThrow();
        }
    });

    it("PASS — maintained configurations contain no obsolete alignment or generated row-number properties", () => {
        const serialized = JSON.stringify([
            ...Object.values(runtimeReports),
            ...Object.values(runtimeDashboards),
            ...Object.values(reports),
            ...Object.values(dashboards),
            ...Object.values(widgets),
        ]);
        expect(serialized).not.toMatch(/"align"\s*:/);
        expect(serialized).not.toMatch(/"(?:rowNumber|row_number|serialNumber|showRowNumbers)"\s*:/i);
    });
});
