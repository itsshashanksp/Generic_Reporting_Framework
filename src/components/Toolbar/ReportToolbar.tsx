import { useState } from "react";
import ToolbarButton from "./ToolbarButton";
import ExportMenu, { type ExportMenuOption } from "../Common/ExportMenu";

import { getRequestErrorMessage } from "../../api/request";
import { useGrid } from "../../engine/GridContext";

import {
    exportCSV,
    exportExcel,
} from "../../engine/ExportEngine";
import type { ToolbarConfig } from "../../types/report";
import type { ExportConfig } from "../../types/export";
import type { ColumnDefinition } from "../../types/column";
import { isSavedReportsEnabled } from "../../engine/ReportDefinitionEngine";

interface ReportToolbarProps {

    config: ToolbarConfig;

    exportConfig?: ExportConfig;

    rows?: Record<string, unknown>[];
    columns?: ColumnDefinition[];

    onExportAll?: (
        format: "csv" | "excel"
    ) => void;

    /** Shows a current-view export message; an empty string clears it. */
    onExportMessage?: (message: string) => void;

    onSaveReport?: () => void;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    isExporting?: boolean;
    allRowsAvailable?: boolean;
}


export default function ReportToolbar({
    config,
    exportConfig,
    rows = [],
    columns,
    onExportAll,
    onExportMessage,
    onSaveReport,
    onRefresh,
    isRefreshing = false,
    isExporting = false,
    allRowsAvailable,
}: ReportToolbarProps) {

    const [currentExporting, setCurrentExporting] = useState(false);

    const {
        api,
    } = useGrid();


    const handleCSVExport = () => {

        if (!api) {
            return;
        }

        onExportMessage?.("");
        try {
            exportCSV(
                api,
                exportConfig?.filename
                    ? `${exportConfig.filename}.csv`
                    : "report.csv"
            );
        } catch {
            onExportMessage?.("The CSV file could not be created.");
        }

    };


    const handleExcelExport = async () => {

        setCurrentExporting(true);
        onExportMessage?.("Exporting…");
        try {
            await exportExcel(
                rows,
                exportConfig?.filename
                    ? `${exportConfig.filename}.xlsx`
                    : "report.xlsx",
                columns
            );
            onExportMessage?.("");
        } catch (error: unknown) {
            onExportMessage?.(getRequestErrorMessage(error, "Unable to create the Excel file."));
        } finally {
            setCurrentExporting(false);
        }

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
                onSelect: () => void handleExcelExport(),
                disabled: !rows.length,
            });
        }
        if (exportConfig.exportAll && onExportAll) {
            if (exportConfig.formats.includes("csv")) exportOptions.push({
                id: "all-csv",
                label: "All rows — CSV",
                disabled: allRowsAvailable === false,
                onSelect: () => onExportAll("csv"),
            });
            if (exportConfig.formats.includes("excel")) exportOptions.push({
                id: "all-excel",
                label: "All rows — Excel",
                disabled: allRowsAvailable === false,
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


                <ExportMenu options={exportOptions} disabled={isRefreshing} busy={isExporting || currentExporting} />


                {isSavedReportsEnabled(config) && onSaveReport && (

                    <ToolbarButton
                        label="Save Report"
                        onClick={
                            onSaveReport
                        }
                        disabled={isRefreshing || isExporting}
                    />

                )}


            </div>

            <div className="report-toolbar__actions report-toolbar__actions--mobile">
                <ExportMenu
                    options={mobileOptions}
                    disabled={isRefreshing && !rows.length}
                    busy={isExporting || currentExporting}
                    triggerLabel="More"
                    busyLabel="Working…"
                    menuLabel="Report actions"
                />
            </div>

        </div>

    );

}
