import GenericGrid from "../Grid/GenericGrid";

import type { ColumnDefinition } from "../../types/column";
import type { GridConfig } from "../../types/report";

interface ReportDataGridProps {
    rows: Record<string, unknown>[];
    columns: ColumnDefinition[];
    gridConfig: GridConfig;
}

export default function ReportDataGrid({
    rows,
    columns,
    gridConfig,
}: ReportDataGridProps) {

    return (
        <GenericGrid
            rows={rows}
            columns={columns}
            gridConfig={gridConfig}
        />
    );
}
