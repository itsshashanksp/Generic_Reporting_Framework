import { useEffect, useRef } from "react";

import { AgGridReact } from "ag-grid-react";

import { useSearch } from "../../engine/SearchEngine";

import {
    defaultColumn,
    defaultGridOptions,
    gridTheme,
} from "../../engine/GridEngine";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

interface Props {
    rows: any[];
    columns: any[];
}

export default function GenericGrid({
    rows,
    columns,
}: Props) {

    const { search } = useSearch();

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
                rowData={rows}
                columnDefs={columns}
                defaultColDef={defaultColumn}
                {...defaultGridOptions}
            />

        </div>

    );

}