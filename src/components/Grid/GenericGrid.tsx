import { AgGridReact } from "ag-grid-react";

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

    return (

        <div
            className={gridTheme.className}
            style={gridTheme.style}
        >

            <AgGridReact
                rowData={rows}
                columnDefs={columns}
                defaultColDef={defaultColumn}
                {...defaultGridOptions}
            />

        </div>

    );

}