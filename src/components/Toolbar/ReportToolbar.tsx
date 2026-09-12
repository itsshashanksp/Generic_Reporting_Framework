import ToolbarButton from "./ToolbarButton";
import ExportMenu, { type ExportMenuOption } from "../Common/ExportMenu";

import { useGrid } from "../../engine/GridContext";

import {
    exportCSV,
    exportExcel,
} from "../../engine/ExportEngine";
import type { ToolbarConfig } from "../../types/report";
import { isSavedReportsEnabled } from "../../engine/ReportDefinitionEngine";

interface ReportToolbarProps {

    config: ToolbarConfig;

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
    onRefresh?: () => void;
    isRefreshing?: boolean;
    isExporting?: boolean;
}


export default function ReportToolbar({
    config,
    exportConfig,
    rows = [],
    onExportAll,
    onSaveReport,
    onRefresh,
    isRefreshing = false,
    isExporting = false,
}: ReportToolbarProps) {

    const {
        api,
    } = useGrid();


    const handleCSVExport = () => {

        if (!api) {
            return;
        }

        exportCSV(
            api,
            exportConfig?.filename
                ? `${exportConfig.filename}.csv`
                : "report.csv"
        );

    };


    const handleExcelExport = () => {

        exportExcel(
            rows,
            exportConfig?.filename
                ? `${exportConfig.filename}.xlsx`
                : "report.xlsx"
        );

    };

    const exportOptions: ExportMenuOption[] = [];
    if (config.export && exportConfig?.enabled) {
        if (exportConfig.exportCurrentView !== false) {
            if (exportConfig.formats.includes("csv")) exportOptions.push({
                id: "current-csv",
                label: "Current view — CSV",
                onSelect: handleCSVExport,
                disabled: !api || !rows.length,
            });
            if (exportConfig.formats.includes("excel")) exportOptions.push({
                id: "current-excel",
                label: "Current view — Excel",
                onSelect: handleExcelExport,
                disabled: !rows.length,
            });
        }
        if (exportConfig.exportAll && onExportAll) {
            if (exportConfig.formats.includes("csv")) exportOptions.push({
                id: "all-csv",
                label: "All rows — CSV",
                onSelect: () => onExportAll("csv"),
            });
            if (exportConfig.formats.includes("excel")) exportOptions.push({
                id: "all-excel",
                label: "All rows — Excel",
                onSelect: () => onExportAll("excel"),
            });
        }
    }

    const mobileOptions: ExportMenuOption[] = [];
    mobileOptions.push(...exportOptions);
    if (isSavedReportsEnabled(config) && onSaveReport) mobileOptions.push({
        id: "save-report",
        label: "Save Report",
        disabled: isRefreshing || isExporting,
        onSelect: onSaveReport,
    });
    if (config.settings) mobileOptions.push({
        id: "settings",
        label: "Settings",
        disabled: true,
        onSelect: () => undefined,
    });


    return (

        <div
            className="report-toolbar"
            role="toolbar"
            aria-label="Report actions"
        >

            <div className="report-toolbar__actions report-toolbar__actions--desktop">

                {config.refresh && (
                    <ToolbarButton
                        label="Refresh"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        title="Refresh report data"
                    />
                )}


                <ExportMenu options={exportOptions} disabled={isRefreshing} busy={isExporting} />


                {isSavedReportsEnabled(config) && onSaveReport && (

                    <ToolbarButton
                        label="Save Report"
                        onClick={
                            onSaveReport
                        }
                        disabled={isRefreshing || isExporting}
                    />

                )}


                {config.settings && (

                    <ToolbarButton
                        label="Settings"
                        title="Report settings are not available yet"
                    />

                )}

            </div>

            <div className="report-toolbar__actions report-toolbar__actions--mobile">
                <ExportMenu
                    options={mobileOptions}
                    disabled={isRefreshing && !rows.length}
                    busy={isExporting}
                    triggerLabel="More"
                    busyLabel="Working…"
                    menuLabel="Report actions"
                />
            </div>

        </div>

    );

}
