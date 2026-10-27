import { afterEach, describe, expect, it, vi } from "vitest";

import { exportChartPNG, exportChartSVG } from "../chartExport";

function chartContainer() {
    const container = document.createElement("div");
    container.innerHTML = '<svg viewBox="0 0 400 200"><text>Sales &amp; Profit</text><rect width="20" height="30" /></svg>';
    document.body.append(container);
    return container;
}

describe("chart graphic exports", () => {
    afterEach(() => vi.restoreAllMocks());

    it("exports a standalone SVG and cleans up its URL", async () => {
        let blob: Blob | undefined;
        vi.spyOn(URL, "createObjectURL").mockImplementation(value => { blob = value as Blob; return "blob:svg"; });
        const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
        exportChartSVG(chartContainer(), "sales.svg");

        expect(click).toHaveBeenCalledTimes(1);
        expect(await blob?.text()).toContain("http://www.w3.org/2000/svg");
        expect(await blob?.text()).toContain("Sales &amp; Profit");
        expect(revoke).toHaveBeenCalledWith("blob:svg");
    });

    it("rasterizes PNG at doubled resolution and revokes temporary URLs", async () => {
        const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:source").mockReturnValueOnce("blob:png");
        const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
        const scale = vi.fn();
        const drawImage = vi.fn();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ scale, fillRect: vi.fn(), drawImage, set fillStyle(_value: string) {} } as unknown as CanvasRenderingContext2D);
        vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(new Blob(["png"], { type: "image/png" })));
        class TestImage {
            decoding = "auto";
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;
            set src(_value: string) { queueMicrotask(() => this.onload?.()); }
        }
        vi.stubGlobal("Image", TestImage);

        await exportChartPNG(chartContainer(), "sales.png");

        expect(createUrl).toHaveBeenCalledTimes(2);
        expect(scale).toHaveBeenCalledWith(2, 2);
        expect(drawImage).toHaveBeenCalled();
        expect(revoke).toHaveBeenCalledWith("blob:source");
        expect(revoke).toHaveBeenCalledWith("blob:png");
    });

    it("reports a missing chart graphic", () => {
        expect(() => exportChartSVG(document.createElement("div"))).toThrow("not available");
    });
});
