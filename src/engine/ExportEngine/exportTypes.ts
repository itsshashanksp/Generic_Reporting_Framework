export const ExportType = {
    CSV: "csv",
    EXCEL: "excel",
} as const;

export type ExportType =
    (typeof ExportType)[keyof typeof ExportType];