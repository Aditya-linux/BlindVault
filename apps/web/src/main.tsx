import "./polyfills";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Toaster } from "./components/ui/sonner";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Pulse Call boot failed: #root element missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
    <Toaster position="bottom-right" richColors closeButton />
  </StrictMode>,
);
