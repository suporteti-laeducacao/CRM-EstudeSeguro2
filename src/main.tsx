import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Impede que a rolagem do mouse altere valores de campos numéricos sem querer:
// ao usar a roda sobre um input numérico focado, ele perde o foco em vez de mudar o valor.
document.addEventListener(
  "wheel",
  (e) => {
    const el = document.activeElement;
    if (
      el instanceof HTMLInputElement &&
      el.type === "number" &&
      el.contains(e.target as Node)
    ) {
      el.blur();
    }
  },
  { capture: true, passive: true },
);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
