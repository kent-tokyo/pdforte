import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import "./styles/global.css";
import App from "./App";

if (import.meta.env.DEV) {
  import("./test-helpers");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
