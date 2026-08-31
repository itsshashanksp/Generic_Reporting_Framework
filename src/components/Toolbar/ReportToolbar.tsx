import ToolbarButton from "./ToolbarButton";

import { useGrid } from "../../engine/GridContext";

import {
    exportCSV,
    exportExcel,
} from "../../engine/ExportEngine";


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

    rows?: Record<string, unknown>[];

    onExportAll?: (
        format: "csv" | "excel"
    ) => void;

    onSaveReport?: () => void;
}


export default function ReportToolbar({
    config,
    exportConfig,
    rows = [],
    onExportAll,
    onSaveReport,
}: ReportToolbarProps) {

    const {
        api,
    } = useGrid();


    const handleCSVExport = () => {

        if (!api) {
            return;
        }

        exportCSV(api);

    };


    const handleExcelExport = () => {

        exportExcel(
            rows,
            exportConfig?.filename
                ? `${exportConfig.filename}.xlsx`
                : "report.xlsx"
        );

    };


    return (

        <div
            style={{
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                marginBottom: "20px",
            }}
        >

            <div>

                {config.refresh && (
                    <ToolbarButton
                        label="Refresh"
                        onClick={() =>
                            window.location.reload()
                        }
                    />
                )}


                {config.export &&
                    exportConfig?.enabled &&
                    exportConfig.formats.includes("csv") &&
                    exportConfig.exportCurrentView && (

                        <ToolbarButton
                            label="Export CSV"
                            onClick={
                                handleCSVExport
                            }
                        />

                    )}


                {config.export &&
                    exportConfig?.enabled &&
                    exportConfig.formats.includes("excel") &&
                    exportConfig.exportCurrentView && (

                        <ToolbarButton
                            label="Export Excel"
                            onClick={
                                handleExcelExport
                            }
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


                {onSaveReport && (

                    <ToolbarButton
                        label="Save Report"
                        onClick={
                            onSaveReport
                        }
                    />

                )}


                {config.settings && (

                    <ToolbarButton
                        label="Settings"
                    />

                )}

            </div>

        </div>

    );

}