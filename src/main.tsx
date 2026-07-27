import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import { SearchProvider } from "./engine/SearchEngine";
import { GridProvider } from "./engine/GridContext";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GridProvider>
      <SearchProvider>
        <App />
      </SearchProvider>
    </GridProvider>
  </React.StrictMode>
);