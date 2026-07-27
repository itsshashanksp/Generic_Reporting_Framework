import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SearchProvider } from "./engine/SearchEngine";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SearchProvider>
    <App />
    </SearchProvider>
  </React.StrictMode>
);