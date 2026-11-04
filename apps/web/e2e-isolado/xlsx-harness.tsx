import { createRoot } from "react-dom/client";
import { PreviaXlsx } from "../src/features/pcm/interfaces/importacao-plano/PreviaXlsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ImportacaoPlanoWorkspace } from "../src/features/pcm/interfaces/importacao-plano/Workspace";

export function montarPrevia() {
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  const raiz = createRoot(container);
  raiz.render(<PreviaXlsx fonteId="fonte-teste" clienteId="cliente-teste" />);
}

export function montarConferencia() {
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  const raiz = createRoot(container);
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  raiz.render(<QueryClientProvider client={query}><ImportacaoPlanoWorkspace userId="16891000-0000-4000-8000-000000000001" clienteId="16891000-0000-4000-8000-000000000002" /></QueryClientProvider>);
}
