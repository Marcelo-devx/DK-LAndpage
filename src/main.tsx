import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary";
import { setupChunkErrorReload } from "./lib/chunkErrorReload";
import "./globals.css";

setupChunkErrorReload();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);