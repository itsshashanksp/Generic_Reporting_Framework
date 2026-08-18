import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import { SearchProvider } from "./engine/SearchEngine";
import { GridProvider } from "./engine/GridContext";
import { FilterProvider } from "./engine/FilterContext";
import { DashboardProvider } from "./engine/DashboardContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GridProvider>
      <SearchProvider>
        <FilterProvider>
          <DashboardProvider>
          <App />
          </DashboardProvider>
        </FilterProvider>
      </SearchProvider>
    </GridProvider>
  </React.StrictMode>
);