import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import { SearchProvider } from "./engine/SearchEngine";
import { GridProvider } from "./engine/GridContext";
import { FilterProvider } from "./engine/FilterContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GridProvider>
      <SearchProvider>
        <FilterProvider>
          <App />
        </FilterProvider>
      </SearchProvider>
    </GridProvider>
  </React.StrictMode>
);