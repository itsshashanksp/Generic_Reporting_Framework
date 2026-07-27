import SearchBox from "./SearchBox";
import ToolbarButton from "./ToolbarButton";

import { toolbarConfig } from "../../engine/ToolbarEngine";

import { useSearch } from "../../engine/SearchEngine";
import { useGrid } from "../../engine/GridContext";

import { exportCSV } from "../../engine/ExportEngine";

export default function ReportToolbar() {

    const {
        search,
        setSearch,
    } = useSearch();

    const {
        api,
    } = useGrid();

    return (

        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
            }}
        >

            <div>

                {toolbarConfig.enableRefresh && (
                    <ToolbarButton
                        label="Refresh"
                        onClick={() => window.location.reload()}
                    />
                )}

                {toolbarConfig.enableExport && (
                    <ToolbarButton
                        label="Export CSV"
                        onClick={() => {

                            if (api) {
                                exportCSV(api);
                            }

                        }}
                    />
                )}

                {toolbarConfig.enableSettings && (
                    <ToolbarButton
                        label="Settings"
                    />
                )}

            </div>

            {toolbarConfig.enableSearch && (

                <SearchBox
                    value={search}
                    onChange={setSearch}
                />

            )}

        </div>

    );

}