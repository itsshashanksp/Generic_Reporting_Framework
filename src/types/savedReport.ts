import type { SortDefinition } from "./report";

export interface SavedReportState {
    filters: Record<string, unknown>;

    sorting: SortDefinition[];

    grouping?: {
        groups: {
            field: string;
        }[];

        aggregates: {
            field: string;
            function: string;
            alias?: string;
        }[];
    };

    pagination: {
        page: number;
        pageSize: number;
    };
}

export interface SavedReport {
    id: string;

    reportId: string;

    name: string;

    createdAt: string;

    updatedAt: string;

    state: SavedReportState;
}