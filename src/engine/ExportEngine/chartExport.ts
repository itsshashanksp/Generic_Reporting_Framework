import { ExportFileError } from "./excelExport";

function chartSvg(container: HTMLElement): SVGSVGElement {
    const source = container.querySelector("svg");
    if (!(source instanceof SVGSVGElement)) throw new ExportFileError("The chart graphic is not available for export.");
    const clone = source.cloneNode(true) as SVGSVGElement;
    const bounds = source.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width || source.clientWidth || 800));
    const height = Math.max(1, Math.round(bounds.height || source.clientHeight || 450));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
    return clone;
}

function serialize(container: HTMLElement) {
    return new XMLSerializer().serializeToString(chartSvg(container));
}

function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

export function exportChartSVG(container: HTMLElement, filename = "chart.svg") {
    try {
        download(new Blob([serialize(container)], { type: "image/svg+xml;charset=utf-8" }), filename);
    } catch (cause: unknown) {
        if (cause instanceof ExportFileError) throw cause;
        throw new ExportFileError("The SVG chart could not be created.", { cause });
    }
}

export async function exportChartPNG(container: HTMLElement, filename = "chart.png") {
    try {
        const svg = chartSvg(container);
        const width = Number(svg.getAttribute("width")) || 800;
        const height = Number(svg.getAttribute("height")) || 450;
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" }));
        try {
            const image = new Image();
            image.decoding = "async";
            await new Promise<void>((resolve, reject) => {
                image.onload = () => resolve();
                image.onerror = () => reject(new Error("The chart image could not be decoded."));
                image.src = url;
            });
            const scale = 2;
            const canvas = document.createElement("canvas");
            canvas.width = width * scale;
            canvas.height = height * scale;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas rendering is unavailable.");
            context.scale(scale, scale);
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, width, height);
            context.drawImage(image, 0, 0, width, height);
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
                result => result ? resolve(result) : reject(new Error("PNG encoding failed.")),
                "image/png"
            ));
            download(blob, filename);
        } finally {
            URL.revokeObjectURL(url);
        }
    } catch (cause: unknown) {
        if (cause instanceof ExportFileError) throw cause;
        throw new ExportFileError("The PNG chart could not be created.", { cause });
    }
}
