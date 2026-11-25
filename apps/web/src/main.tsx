import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./app/App";
import { queryClient } from "./app/query-client";

const container = document.getElementById("root");
if (!container) throw new Error("Elemento #root não encontrado no index.html");

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

// E00-S29 — tira o shell de primeira pintura (index.html) assim que o app assume. O `#root` e o
// shell usam a MESMA cor de fundo, então a troca não pisca. `requestAnimationFrame` espera o
// primeiro quadro pintado com o app dentro; remover antes deixaria um frame de branco.
requestAnimationFrame(() => {
  document.getElementById("sso-shell")?.remove();
});
