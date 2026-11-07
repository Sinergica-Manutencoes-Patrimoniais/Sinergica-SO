import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabaseOrcamentoOperacionalAdapter } from "../../infrastructure/supabase-orcamento-operacional-adapter";
import { PrepararOrcamentoOperacional } from "./PrepararOrcamento";
import { CriarOrcamento } from "./CriarOrcamento";
import { TransicionarOperacional } from "./TransicionarOperacional";
import { DispensarOrcamento } from "./DispensarOrcamento";
import { ExcecaoPreco } from "./ExcecaoPreco";
import { ClassificacaoLinha } from "./ClassificacaoLinha";
import { HistoricoLegadoOs } from "./HistoricoLegadoOs";
import { HistoricoLegadoPreOs } from "./HistoricoLegadoPreOs";
import { DecidirOrcamentoPcm } from "./DecidirOrcamentoPcm";

type Props = { usuario: string; cliente: string; ordemServico: string; listaInicialId?: string };
export function OrcamentosDaOs({ usuario, cliente, ordemServico, listaInicialId }: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const consulta = useInfiniteQuery({
    queryKey: ["orcamentos-operacionais", usuario, cliente, ordemServico],
    initialPageParam: null as string | null,
    enabled: Boolean(usuario && cliente && ordemServico),
    gcTime: 0,
    queryFn: ({ pageParam, signal }) =>
      supabaseOrcamentoOperacionalAdapter.listar(cliente, ordemServico, 20, pageParam, signal),
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  const itens = consulta.isFetching || consulta.isError ? [] : (consulta.data?.pages.flat() ?? []);
  return (
    <section aria-label="Orçamentos operacionais da OS">
      <h3>Orçamentos operacionais da OS</h3>
      <CriarOrcamento key={JSON.stringify([usuario, cliente, ordemServico, listaInicialId ?? null])} usuario={usuario} cliente={cliente} ordemServico={ordemServico} listaInicialId={listaInicialId} />
      <DispensarOrcamento usuario={usuario} cliente={cliente} ordemServico={ordemServico} />
      {import.meta.env.VITE_SSO_HISTORICO_ORCAMENTO_LEGADO_ENABLED === "true" && <HistoricoLegadoOs usuario={usuario} cliente={cliente} os={ordemServico} />}
      {import.meta.env.VITE_SSO_HISTORICO_ORCAMENTO_PRE_OS_ENABLED === "true" && <HistoricoLegadoPreOs key={`${usuario}:${cliente}`} usuario={usuario} cliente={cliente} />}
      <p>
        Consulta parcial de vínculos canônicos; não inclui necessariamente orçamentos históricos.
        Emissão e decisão ainda não disponíveis.
      </p>
      {consulta.isFetching && <output>Consultando orçamentos…</output>}
      {consulta.isError && (
        <p role="alert">
          Não foi possível consultar orçamentos.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!consulta.isFetching && !consulta.isError && itens.length === 0 && (
        <p>Nenhum vínculo canônico disponível para consulta.</p>
      )}
      {!consulta.isFetching && !consulta.isError && (
        <ul>
          {itens.map((item) => (
            <li key={item.id}>
              Proposta {item.id} · {item.status === "aceita" ? "aprovada" : item.status} · versão{" "}
              {item.versao}
              {item.status === "rascunho" && <ExcecaoPreco usuario={usuario} cliente={cliente} ordemServico={ordemServico} propostaId={item.id} versao={item.versao} />}
              {item.status === "aceita" && import.meta.env.VITE_SSO_CLASSIFICACAO_LINHA_ENABLED === "true" && <ClassificacaoLinha key={`${item.id}:${item.versao}`} usuario={usuario} cliente={cliente} proposta={item.id} versao={item.versao} />}
              <TransicionarOperacional usuario={usuario} cliente={cliente} ordemServico={ordemServico} propostaId={item.id} versao={item.versao} status={item.status} />
              {import.meta.env.VITE_SSO_DECISAO_PCM_ORCAMENTO_ENABLED === "true" && <DecidirOrcamentoPcm key={item.id} usuario={usuario} cliente={cliente} os={ordemServico} proposta={item.id} versao={item.versao} status={item.status} />}
              {item.status === "rascunho" && (
                <>
                  <button type="button" onClick={() => setEditando(editando === item.id ? null : item.id)}>
                    {editando === item.id ? "Fechar composição" : "Editar composição"}
                  </button>
                  {editando === item.id && (
                    <PrepararOrcamentoOperacional
                      usuario={usuario}
                      cliente={cliente}
                      propostaId={item.id}
                      permitirEdicao={true}
                      propostaRevisao={item.versao}
                      listaId={item.lista_id}
                      listaRevisao={item.lista_revisao}
                      aoSalvar={() => {
                        setEditando(null);
                        void queryClient.invalidateQueries({ queryKey: ["orcamentos-operacionais", usuario, cliente, ordemServico] });
                      }}
                    />
                  )}
                </>
              )}
              {item.status !== "rascunho" && <PrepararOrcamentoOperacional usuario={usuario} cliente={cliente} propostaId={item.id} propostaRevisao={item.versao} listaId={item.lista_id} listaRevisao={item.lista_revisao} permitirEdicao={false} aoSalvar={() => { void queryClient.invalidateQueries({ queryKey: ["orcamentos-operacionais", usuario, cliente, ordemServico] }); }} />}
            </li>
          ))}
        </ul>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.hasNextPage && (
        <button type="button" onClick={() => void consulta.fetchNextPage()}>
          Carregar mais orçamentos
        </button>
      )}
    </section>
  );
}
