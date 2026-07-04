// Página da Visão 360 do Cliente (E01-S12) — sub-tela read-only do PCM.
// Recebe `clienteId` por prop (o app ainda não tem roteamento por id — ver OPEN-QUESTION #3 em
// tasks.md; a página é testável/integrável isoladamente). Orquestra o gate AC-1 + o caso de uso.
//
// AC-7 (somente leitura): NENHUM elemento de mutação em nenhum estado — sem botão de editar OS,
// repriorizar/alterar GUT, mudar status, criar OS ou disparar sync. Os 4 painéis abaixo só exibem
// dados. Qualquer ação de escrita permanece nas telas de origem (Hub de OS etc.).
import { useCallback, useEffect, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import { type VisaoCliente, obterVisaoCliente } from "../application/obter-visao-cliente";
import { CabecalhoCliente } from "../components/CabecalhoCliente";
import { ClienteNaoEncontrado } from "../components/ClienteNaoEncontrado";
import { PainelBacklog } from "../components/PainelBacklog";
import { PainelEquipamentos } from "../components/PainelEquipamentos";
import { PainelHistorico } from "../components/PainelHistorico";
import { supabaseCliente360Adapter } from "../infrastructure/supabase-cliente-360-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; visao: VisaoCliente };

export function VisaoClientePage({ clienteId }: { clienteId: string }) {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  // AC-1: só carrega/renderiza o conteúdo com leitura no módulo pcm (mesma checagem das demais
  // telas do PCM; superadmin já é bypass dentro de podeAcessarModulo). Sem permissão nova.
  const temAcesso = podeAcessar("pcm", "leitura");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const visao = await obterVisaoCliente(supabaseCliente360Adapter, clienteId);
      setEstado({ fase: "pronto", visao });
    } catch {
      // AC-8/AC-5 são estados de retorno (não exceções); aqui só cai erro inesperado de
      // infra (rede/permissão de banco) — mensagem neutra, sem vazar detalhe de implementação.
      setEstado({ fase: "erro", mensagem: "Não foi possível carregar a visão do cliente." });
    }
  }, [clienteId]);

  useEffect(() => {
    if (!permissoesCarregando && temAcesso) carregar();
  }, [permissoesCarregando, temAcesso, carregar]);

  if (permissoesCarregando) {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  // AC-1: sem leitura no módulo pcm, a tela não é acessível.
  if (!temAcesso) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="text-sm text-ink-3 mt-1">
          Você não tem permissão de leitura no módulo PCM para ver esta tela.
        </p>
      </div>
    );
  }

  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="text-sm text-ink-3 mt-1">{estado.mensagem}</p>
        <button
          type="button"
          onClick={carregar}
          className="mt-4 text-sm font-semibold text-orange hover:text-orange-deep cursor-pointer"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // AC-8: cliente inexistente/soft-deleted.
  if (estado.visao.tipo === "nao_encontrado") {
    return <ClienteNaoEncontrado />;
  }

  const { cliente, backlog, historico, equipamentos } = estado.visao;

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoCliente cliente={cliente} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PainelBacklog ordens={backlog} />
        <PainelHistorico ordens={historico} />
      </div>
      <PainelEquipamentos equipamentos={equipamentos} />
    </div>
  );
}
