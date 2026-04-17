import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

import { ModalProvider } from "./context/ModalContext";
import { DashboardProvider } from "./context/DashboardContext";
import AuthGate from "./context/AuthGate";
import { ToastProvider } from "./context/ToastContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthGate>
        <DashboardProvider>
          <ModalProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </ModalProvider>
        </DashboardProvider>
      </AuthGate>
    </BrowserRouter>
  </React.StrictMode>
);
