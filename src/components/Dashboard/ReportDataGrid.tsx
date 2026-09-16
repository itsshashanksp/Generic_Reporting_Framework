import GenericGrid from "../Grid/GenericGrid";

import type { ColumnDefinition } from "../../types/column";
import type { GridConfig, SortDefinition } from "../../types/report";

interface ReportDataGridProps {
    rows: Record<string, unknown>[];
    columns: ColumnDefinition[];
    gridConfig: GridConfig;
    initialSort?: SortDefinition[];
}

export default function ReportDataGrid({
    rows,
    columns,
    gridConfig,
    initialSort,
}: ReportDataGridProps) {

    return (
        <GenericGrid
            rows={rows}
            columns={columns}
            gridConfig={gridConfig}
            initialSort={initialSort}
            height="100%"
        />
    );
}
