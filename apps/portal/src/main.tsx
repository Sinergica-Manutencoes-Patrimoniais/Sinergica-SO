import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../web/src/index.css";
import { PortalApp } from "./portal-app";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado");
createRoot(root).render(
  <StrictMode>
    <PortalApp />
  </StrictMode>,
);
