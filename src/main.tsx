import React from "react";
import ReactDOM from "react-dom/client";

import { SetupProvider } from "./setup";
import ApplicationProviders from "./ApplicationProviders";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SetupProvider>
      <ApplicationProviders />
    </SetupProvider>
  </React.StrictMode>
);
