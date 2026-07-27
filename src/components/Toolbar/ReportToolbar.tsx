import { useState } from "react";

import SearchBox from "./SearchBox";
import ToolbarButton from "./ToolbarButton";

import { toolbarConfig } from "../../engine/ToolbarEngine";

export default function ReportToolbar() {

    const [search, setSearch] = useState("");

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
                    <ToolbarButton label="Refresh" />
                )}

                {toolbarConfig.enableExport && (
                    <ToolbarButton label="Export" />
                )}

                {toolbarConfig.enableSettings && (
                    <ToolbarButton label="Settings" />
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