import React from "react";
import { createRoot } from "react-dom/client";
import PaymentsPage from "./pages/payments";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root not found");
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <PaymentsPage />
  </React.StrictMode>
);
