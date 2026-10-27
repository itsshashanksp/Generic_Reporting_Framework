export type ExportFormat =
    | "csv"
    | "excel"
    | "png"
    | "svg";

export interface ExportConfig {
    enabled: boolean;

    formats: ExportFormat[];

    filename?: string;

    exportAll?: boolean;

    exportCurrentView?: boolean;
}
