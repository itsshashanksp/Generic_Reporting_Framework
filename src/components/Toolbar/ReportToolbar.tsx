import SearchBox from "./SearchBox";
import ToolbarButton from "./ToolbarButton";

import { useSearch } from "../../engine/SearchEngine";
import { useGrid } from "../../engine/GridContext";

import { exportCSV } from "../../engine/ExportEngine";

interface ReportToolbarProps {
    config: {
        search: boolean;
        export: boolean;
        refresh: boolean;
        settings: boolean;
    };
}

export default function ReportToolbar({
    config,
}: ReportToolbarProps) {

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

                {config.refresh && (
                    <ToolbarButton
                        label="Refresh"
                        onClick={() => window.location.reload()}
                    />
                )}

                {config.export && (
                    <ToolbarButton
                        label="Export CSV"
                        onClick={() => {
                            if (api) {
                                exportCSV(api);
                            }
                        }}
                    />
                )}

                {config.settings && (
                    <ToolbarButton
                        label="Settings"
                    />
                )}

            </div>

            {config.search && (
                <SearchBox
                    value={search}
                    onChange={setSearch}
                />
            )}

        </div>

    );

}