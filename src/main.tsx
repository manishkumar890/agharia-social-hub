// Load core-js & regenerator-runtime FIRST for full ES5 compatibility
import "core-js/stable";
import "regenerator-runtime/runtime";

// Load app-specific polyfills
import "./lib/polyfills";

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);