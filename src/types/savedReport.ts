import type { SortDefinition } from "./report";
import type { FilterValues } from "../engine/FilterContext/FilterContext";

export interface SavedReportState {
    filters: FilterValues;

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
