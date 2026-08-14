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

    exportConfig?: {
        enabled: boolean;
        formats: ("csv" | "excel")[];
        filename?: string;
        exportAll?: boolean;
        exportCurrentView?: boolean;
    };

    onExportAll?: (
        format: "csv" | "excel"
    ) => void;
}

export default function ReportToolbar({
    config,
    exportConfig,
    onExportAll,
}: ReportToolbarProps) {

    const {
        search,
        setSearch,
    } = useSearch();

    const {
        api,
    } = useGrid();

    const handleCSVExport = () => {

        if (!api) {
            return;
        }

        exportCSV(api);
    };

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

                {config.export &&
                    exportConfig?.enabled &&
                    exportConfig.formats.includes("csv") &&
                    exportConfig.exportCurrentView && (
                        <ToolbarButton
                            label="Export CSV"
                            onClick={handleCSVExport}
                        />
                    )}

                {config.export &&
                    exportConfig?.enabled &&
                    exportConfig.formats.includes("excel") &&
                    exportConfig.exportCurrentView && (
                        <ToolbarButton
                            label="Export Excel"
                            onClick={() => {

                                if (!api) {
                                    return;
                                }

                                api.exportDataAsExcel({
                                    fileName:
                                        exportConfig.filename
                                            ? `${exportConfig.filename}.xlsx`
                                            : "report.xlsx",
                                });

                            }}
                        />
                    )}

                {config.export &&
                    exportConfig?.enabled &&
                    exportConfig.exportAll &&
                    exportConfig.formats.includes("csv") &&
                    onExportAll && (
                        <ToolbarButton
                            label="Export All CSV"
                            onClick={() =>
                                onExportAll("csv")
                            }
                        />
                    )}

                {config.export &&
                    exportConfig?.enabled &&
                    exportConfig.exportAll &&
                    exportConfig.formats.includes("excel") &&
                    onExportAll && (
                        <ToolbarButton
                            label="Export All Excel"
                            onClick={() =>
                                onExportAll("excel")
                            }
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