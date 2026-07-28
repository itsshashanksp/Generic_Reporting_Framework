import { useEffect, useRef } from "react";

import { AgGridReact } from "ag-grid-react";

import { useSearch } from "../../engine/SearchEngine";
import { useGrid } from "../../engine/GridContext";

import {
    defaultColumn,
    defaultGridOptions,
    gridTheme,
} from "../../engine/GridEngine";

import type { GridConfig } from "../../types/report";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

interface Props {
    rows: any[];
    columns: any[];
    gridConfig: GridConfig;
}

export default function GenericGrid({
    rows,
    columns,
    gridConfig,
}: Props) {

    const { search } = useSearch();

    const { setApi } = useGrid();

    const gridRef = useRef<AgGridReact>(null);

    useEffect(() => {

        if (gridRef.current?.api) {

            gridRef.current.api.setGridOption(
                "quickFilterText",
                search
            );

        }

    }, [search]);

    return (

        <div
            className={gridTheme.className}
            style={gridTheme.style}
        >

            <AgGridReact
                ref={gridRef}

                onGridReady={(params) => {
                    setApi(params.api);
                }}

                rowData={rows}
                columnDefs={columns}

                defaultColDef={defaultColumn}

                pagination={gridConfig.pagination}
                paginationPageSize={gridConfig.pageSize}
                rowSelection={gridConfig.rowSelection}

                {...defaultGridOptions}
            />

        </div>

    );

}