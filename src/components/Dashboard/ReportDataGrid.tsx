import GenericGrid from "../Grid/GenericGrid";

interface ReportDataGridProps {
    rows: any[];
    columns: any[];
    gridConfig: any;
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