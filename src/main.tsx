import React from "react";
import ReactDOM from "react-dom/client";

import { SetupProvider } from "./setup";
import ApplicationProviders from "./ApplicationProviders";
import { applyApplicationBranding } from "./config/branding";
import "./styles/index.css";

applyApplicationBranding(document);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SetupProvider>
      <ApplicationProviders />
    </SetupProvider>
  </React.StrictMode>
);
