export type ExportFormat =
    | "csv"
    | "excel";

export interface ExportConfig {
    enabled: boolean;

    formats: ExportFormat[];

    filename?: string;

    exportAll?: boolean;

    exportCurrentView?: boolean;
}