import { useState } from "react";
import { WorkspaceListasMateriais } from "../listas-materiais/Workspace";

/** O próprio workspace consulta a capacidade do Cliente e valida a OS no servidor. */
export function MateriaisDaOrdem({ usuario, cliente, ordem, numero }: {
  usuario: string; cliente: string; ordem: string; numero: string;
}) {
  const [aberto, setAberto] = useState(false);
  if (import.meta.env.VITE_SSO_LISTAS_MATERIAIS_ENABLED !== "true") return null;
  return <section aria-label={`Materiais da OS ${numero}`}>
    <button type="button" aria-expanded={aberto} onClick={() => setAberto((atual) => !atual)}>
      {aberto ? `Fechar materiais da OS ${numero}` : `Consultar materiais da OS ${numero}`}
    </button>
    {aberto && <WorkspaceListasMateriais usuario={usuario} cliente={cliente} ordemServico={ordem} />}
  </section>;
}
