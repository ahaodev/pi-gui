import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./dev-reload-hook";
// shadcn.css must come FIRST: Tailwind v4 emits its default theme variables
// unlayered, so the app's own token declarations (styles.css, also unlayered)
// must follow in source order to win the cascade for shared names
// (--text-*, --radius-*, --shadow-*, ...).
import "./styles/shadcn.css";
import "./styles.css";
import { TooltipProvider } from "@/components/ui/tooltip";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={100}>
      <App />
    </TooltipProvider>
  </React.StrictMode>,
);
