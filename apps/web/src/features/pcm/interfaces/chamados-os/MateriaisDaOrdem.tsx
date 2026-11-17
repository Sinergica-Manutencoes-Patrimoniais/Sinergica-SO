import { useState } from "react";
import { flagLigada } from "../../../../config/flags-sso";
import { WorkspaceListasMateriais } from "../listas-materiais/Workspace";
import { RecursoNaoAtivado } from "@sinergica/ui";

/** O próprio workspace consulta a capacidade do Cliente e valida a OS no servidor. */
export function MateriaisDaOrdem({
  usuario,
  cliente,
  ordem,
  numero,
}: {
  usuario: string;
  cliente: string;
  ordem: string;
  numero: string;
}) {
  const [aberto, setAberto] = useState(false);
  // SPEC_DEVIATION (E00-S28 AC-3): renderizado uma vez por OS numa lista — um `RecursoNaoAtivado`
  // por linha vira ruído, não aviso útil. A visibilidade do recurso já é dada uma única vez, no
  // nível do Chamado, pela lista de materiais do workspace (ver E01-S198/visibilidade de materiais).
  if (!flagLigada("VITE_SSO_LISTAS_MATERIAIS_ENABLED")) {
    return (
      <RecursoNaoAtivado
        recurso="Listas materiais"
        podeAdministrar={false}
        faltando={["VITE_SSO_LISTAS_MATERIAIS_ENABLED"]}
      />
    );
  }
  return (
    <section aria-label={`Materiais da OS ${numero}`}>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((atual) => !atual)}>
        {aberto ? `Fechar materiais da OS ${numero}` : `Consultar materiais da OS ${numero}`}
      </button>
      {aberto && (
        <WorkspaceListasMateriais usuario={usuario} cliente={cliente} ordemServico={ordem} />
      )}
    </section>
  );
}
