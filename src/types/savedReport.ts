import type { SortDefinition } from "./report";
import type { FilterValues } from "../engine/FilterContext/FilterContext";

export interface SavedReportState {
    filters: FilterValues;

    sorting: SortDefinition[];

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
