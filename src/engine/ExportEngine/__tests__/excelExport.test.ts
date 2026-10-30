import { afterEach, describe, expect, it, vi } from "vitest";

import { exportExcel, getExcelSheetData } from "../excelExport";

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
    const stream = new ReadableStream<BufferSource>({
        start(controller) {
            controller.enqueue(data.slice());
            controller.close();
        },
    }).pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Minimal ZIP reader (central directory) for inspecting generated XLSX parts. */
async function unzip(bytes: Uint8Array): Promise<Record<string, string>> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = bytes.length - 22;
    while (view.getUint32(end, true) !== 0x06054b50) end -= 1;
    const entries = view.getUint16(end + 10, true);
    let offset = view.getUint32(end + 16, true);
    const files: Record<string, string> = {};
    for (let index = 0; index < entries; index += 1) {
        const method = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
        const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
        const data = bytes.subarray(dataStart, dataStart + compressedSize);
        files[name] = new TextDecoder().decode(method === 8 ? await inflateRaw(data) : data);
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return files;
}

async function captureWorkbook(rows: Record<string, unknown>[], fileName?: string, columns?: Parameters<typeof exportExcel>[2]) {
    let blob: Blob | undefined;
    const downloads: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation(value => {
        blob = value as Blob;
        return "blob:xlsx";
    });
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
    });

    await exportExcel(rows, fileName, columns);
    // write-excel-file removes its download link and revokes the object URL
    // 100 ms after the click; let that finish before jsdom is torn down.
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:xlsx");
    expect(document.querySelector("a[download]")).toBeNull();

    const files = await unzip(new Uint8Array(await blob!.arrayBuffer()));
    const sharedStrings = [...(files["xl/sharedStrings.xml"] ?? "").matchAll(/<si><t[^>]*>([^<]*)<\/t><\/si>/g)]
        .map(match => match[1]);
    const cells = Object.fromEntries([...files["xl/worksheets/sheet1.xml"].matchAll(/<c r="([A-Z]+\d+)"([^>]*)>(.*?)<\/c>/g)]
        .map(([, ref, attributes, body]) => {
            const type = /t="([^"]+)"/.exec(attributes)?.[1] ?? "n";
            const raw = /<v>([^<]*)<\/v>/.exec(body)?.[1];
            const value = type === "s" && raw !== undefined ? sharedStrings[Number(raw)] : raw;
            return [ref, { type, value, formula: /<f>/.test(body), style: /s="(\d+)"/.exec(attributes)?.[1] }];
        }));
    return { downloads, files, cells };
}

const rows = [
    { Month: "2021-06", Sales: 505308.4, Count: 12, Code: "00123", Active: true, Note: null, When: new Date(Date.UTC(2021, 5, 30)), Iso: "2021-06-30" },
    { Month: "2021-05", Sales: -1250.5, Count: "17", Extra: "late key", Active: false, Note: undefined },
];

describe("Excel export (write-excel-file)", () => {
    afterEach(() => vi.restoreAllMocks());

    it("keeps the SheetJS header order: first-seen keys, later keys appended", () => {
        expect(getExcelSheetData(rows)[0]).toEqual(
            ["Month", "Sales", "Count", "Code", "Active", "Note", "When", "Iso", "Extra"].map(value => ({ type: String, value, align: "left", fontWeight: "bold" }))
        );
    });

    it("writes the same cell types as the previous export", () => {
        const [, first, second] = getExcelSheetData(rows);
        expect(first).toEqual([
            { type: String, value: "2021-06", align: "left" },
            { type: Number, value: 505308.4, align: "right" },
            { type: Number, value: 12, align: "right" },
            { type: String, value: "00123", align: "left" },
            { type: Boolean, value: true, align: "left" },
            null,
            { type: Date, value: new Date(Date.UTC(2021, 5, 30)), format: "m/d/yy", align: "left" },
            { type: String, value: "2021-06-30", align: "left" },
            null,
        ]);
        expect(second).toEqual([
            { type: String, value: "2021-05", align: "left" },
            { type: Number, value: -1250.5, align: "right" },
            { type: String, value: "17", align: "left" },
            null,
            { type: Boolean, value: false, align: "left" },
            null,
            null,
            null,
            { type: String, value: "late key", align: "left" },
        ]);
    });

    it("downloads a Report sheet with the requested filename and typed cells", async () => {
        const { downloads, files, cells } = await captureWorkbook(rows, "sales-report.xlsx");

        expect(downloads).toEqual(["sales-report.xlsx"]);
        expect(files["xl/workbook.xml"]).toMatch(/<sheet [^>]*name="Report"/);
        expect(cells.A1).toMatchObject({ type: "s", value: "Month" });
        expect(cells.I1).toMatchObject({ type: "s", value: "Extra" });
        expect(cells.B2).toMatchObject({ type: "n", value: "505308.4" });
        expect(cells.B3).toMatchObject({ type: "n", value: "-1250.5" });
        expect(cells.D2).toMatchObject({ type: "s", value: "00123" });
        expect(cells.C3).toMatchObject({ type: "s", value: "17" });
        expect(cells.E2).toMatchObject({ type: "b", value: "1" });
        expect(cells.F2).toBeUndefined();
        expect(cells.I3).toMatchObject({ type: "s", value: "late key" });
        expect(Number(cells.G2.value)).toBeCloseTo(44377, 0);
        expect(files["xl/styles.xml"]).toContain('formatCode="m/d/yy"');
    });

    it("uses configured headers, typed SQL numbers, alignment, and currency/percentage formats", async () => {
        const columns = [
            { field: "Label", header: "Description", dataType: "text" as const },
            { field: "Amount", header: "Amount", dataType: "currency" as const },
            { field: "Rate", header: "GST %", dataType: "percentage" as const },
        ];
        const sheet = getExcelSheetData([{ Label: "Sale", Amount: "1250.5", Rate: "18", Internal: 1 }], columns);
        expect(sheet[0]).toEqual([
            { type: String, value: "Description", align: "left", fontWeight: "bold" },
            { type: String, value: "Amount", align: "left", fontWeight: "bold" },
            { type: String, value: "GST %", align: "left", fontWeight: "bold" },
        ]);
        expect(sheet[1]).toEqual([
            { type: String, value: "Sale", align: "left" },
            { type: Number, value: 1250.5, align: "right", format: "₹#,##0.00" },
            { type: Number, value: 18, align: "right", format: '0.00"%"' },
        ]);
        const { cells } = await captureWorkbook([{ Label: "Sale", Amount: "1250.5", Rate: "18" }], "typed.xlsx", columns);
        expect(cells.B2).toMatchObject({ type: "n", value: "1250.5" });
        expect(cells.C2).toMatchObject({ type: "n", value: "18" });
    });

    it("keeps the default filename", async () => {
        const { downloads } = await captureWorkbook([{ A: 1 }]);
        expect(downloads).toEqual(["Report.xlsx"]);
    });

    it("never writes formula-looking text as a formula", async () => {
        const { files, cells } = await captureWorkbook([{ Value: "=HYPERLINK(\"http://x\",\"y\")" }, { Value: "+1+1" }]);

        expect(files["xl/worksheets/sheet1.xml"]).not.toContain("<f>");
        expect(cells.A2).toMatchObject({ type: "s", formula: false });
        expect(cells.A3).toMatchObject({ type: "s", value: "+1+1", formula: false });
    });

    it("writes non-finite numbers as text and skips empty exports", async () => {
        expect(getExcelSheetData([{ A: Number.NaN, B: Infinity }])[1]).toEqual([
            { type: String, value: "NaN", align: "left" },
            { type: String, value: "Infinity", align: "left" },
        ]);
        const createObjectURL = vi.spyOn(URL, "createObjectURL");
        await exportExcel([]);
        expect(createObjectURL).not.toHaveBeenCalled();
    });
});
