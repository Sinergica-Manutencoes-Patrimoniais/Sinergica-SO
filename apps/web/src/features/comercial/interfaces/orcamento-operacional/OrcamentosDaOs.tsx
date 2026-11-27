import { AvisoFalhaConsulta } from "@sinergica/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { flagLigada } from "../../../../config/flags-sso";
import { TEXTO_FALHA_ATIVACAO, mensagemFalhaAtivacao } from "../../../../lib/mensagem-ativacao";
import { supabaseOrcamentoOperacionalAdapter } from "../../infrastructure/supabase-orcamento-operacional-adapter";
import { ClassificacaoLinha } from "./ClassificacaoLinha";
import { CriarOrcamento } from "./CriarOrcamento";
import { DecidirOrcamentoPcm } from "./DecidirOrcamentoPcm";
import { DispensarOrcamento } from "./DispensarOrcamento";
import { ExcecaoPreco } from "./ExcecaoPreco";
import { HistoricoLegadoOs } from "./HistoricoLegadoOs";
import { HistoricoLegadoPreOs } from "./HistoricoLegadoPreOs";
import { PrepararOrcamentoOperacional } from "./PrepararOrcamento";
import { TransicionarOperacional } from "./TransicionarOperacional";

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
  // 403/42501 é negação permanente: repetir devolve a mesma resposta (DEF-12).
  const negacao = mensagemFalhaAtivacao(consulta.error);
  return (
    <section aria-label="Orçamentos operacionais da OS">
      <h3>Orçamentos operacionais da OS</h3>
      <CriarOrcamento
        key={JSON.stringify([usuario, cliente, ordemServico, listaInicialId ?? null])}
        usuario={usuario}
        cliente={cliente}
        ordemServico={ordemServico}
        listaInicialId={listaInicialId}
      />
      <DispensarOrcamento usuario={usuario} cliente={cliente} ordemServico={ordemServico} />
      {flagLigada("VITE_SSO_HISTORICO_ORCAMENTO_LEGADO_ENABLED") && (
        <HistoricoLegadoOs usuario={usuario} cliente={cliente} os={ordemServico} />
      )}
      {flagLigada("VITE_SSO_HISTORICO_ORCAMENTO_PRE_OS_ENABLED") && (
        <HistoricoLegadoPreOs key={`${usuario}:${cliente}`} usuario={usuario} cliente={cliente} />
      )}
      <p>
        Consulta parcial de vínculos canônicos; não inclui necessariamente orçamentos históricos.
        Emissão e decisão ainda não disponíveis.
      </p>
      {consulta.isFetching && <output>Consultando orçamentos…</output>}
      {consulta.isError && (
        <AvisoFalhaConsulta onTentarNovamente={negacao ? undefined : () => void consulta.refetch()}>
          {negacao ? TEXTO_FALHA_ATIVACAO[negacao] : "Não foi possível consultar orçamentos."}
        </AvisoFalhaConsulta>
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
              {item.status === "rascunho" && (
                <ExcecaoPreco
                  usuario={usuario}
                  cliente={cliente}
                  ordemServico={ordemServico}
                  propostaId={item.id}
                  versao={item.versao}
                />
              )}
              {item.status === "aceita" && flagLigada("VITE_SSO_CLASSIFICACAO_LINHA_ENABLED") && (
                <ClassificacaoLinha
                  key={`${item.id}:${item.versao}`}
                  usuario={usuario}
                  cliente={cliente}
                  proposta={item.id}
                  versao={item.versao}
                />
              )}
              <TransicionarOperacional
                usuario={usuario}
                cliente={cliente}
                ordemServico={ordemServico}
                propostaId={item.id}
                versao={item.versao}
                status={item.status}
              />
              {flagLigada("VITE_SSO_DECISAO_PCM_ORCAMENTO_ENABLED") && (
                <DecidirOrcamentoPcm
                  key={item.id}
                  usuario={usuario}
                  cliente={cliente}
                  os={ordemServico}
                  proposta={item.id}
                  versao={item.versao}
                  status={item.status}
                />
              )}
              {item.status === "rascunho" && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditando(editando === item.id ? null : item.id)}
                  >
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
                        void queryClient.invalidateQueries({
                          queryKey: ["orcamentos-operacionais", usuario, cliente, ordemServico],
                        });
                      }}
                    />
                  )}
                </>
              )}
              {item.status !== "rascunho" && (
                <PrepararOrcamentoOperacional
                  usuario={usuario}
                  cliente={cliente}
                  propostaId={item.id}
                  propostaRevisao={item.versao}
                  listaId={item.lista_id}
                  listaRevisao={item.lista_revisao}
                  permitirEdicao={false}
                  aoSalvar={() => {
                    void queryClient.invalidateQueries({
                      queryKey: ["orcamentos-operacionais", usuario, cliente, ordemServico],
                    });
                  }}
                />
              )}
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
