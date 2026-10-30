import { describe, expect, it } from "vitest";

import { getChartCapability } from "../chartCapabilities";

describe("chart presentation capabilities", () => {
    it("assigns chart-specific presentation and overflow policies", () => {
        expect(getChartCapability("bar")).toMatchObject({
            presentation: "cartesian",
            overflow: "orientation-aware",
            tooltipMode: "series",
        });
        expect(getChartCapability("line")).toMatchObject({ presentation: "cartesian", overflow: "horizontal" });
        expect(getChartCapability("area")).toMatchObject({ presentation: "cartesian", overflow: "horizontal" });
        expect(getChartCapability("pie")).toMatchObject({ presentation: "proportional", overflow: "adapt" });
        expect(getChartCapability("doughnut")).toMatchObject({ presentation: "proportional", overflow: "adapt" });
        expect(getChartCapability("treemap")).toMatchObject({ presentation: "hierarchical", overflow: "adapt" });
        expect(getChartCapability("radial-bar")).toMatchObject({ presentation: "radial", overflow: "adapt" });
    });

    it("keeps legacy Funnel unsupported", () => {
        expect(getChartCapability("funnel")).toMatchObject({ supported: false });
    });
});
