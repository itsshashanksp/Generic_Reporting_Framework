import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import { AuthProvider } from "./auth";
import { GridProvider } from "./engine/GridContext";
import { FilterProvider } from "./engine/FilterContext";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <GridProvider>
        <FilterProvider>
          <App />
        </FilterProvider>
      </GridProvider>
    </AuthProvider>
  </React.StrictMode>
);
