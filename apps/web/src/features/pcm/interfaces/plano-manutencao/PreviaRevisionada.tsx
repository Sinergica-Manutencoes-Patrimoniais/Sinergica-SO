import { Button } from "@sinergica/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import type { CamposComparacaoRotina } from "../../application/plano-manutencao-gateway";
import { planoManutencaoKeys } from "../../application/plano-manutencao-queries";
import { supabasePlanoManutencaoAdapter } from "../../infrastructure/supabase-plano-manutencao-adapter";
import { DiagnosticoOsRevisao } from "./DiagnosticoOsRevisao";
import { IndiciosRevisaoRotina } from "./IndiciosRevisaoRotina";
import { ComparacaoQuestionario } from "./ComparacaoQuestionario";
import { DiagnosticoVigencias } from "./DiagnosticoVigencias";
import { DecisaoImpactoOcorrencia } from "./DecisaoImpactoOcorrencia";
import { DecisaoImpactoVisita } from "./DecisaoImpactoVisita";

function Campos({ titulo, dados }: { titulo: string; dados: CamposComparacaoRotina | null }) {
  if (!dados)
    return (
      <section>
        <h4>{titulo}</h4>
        <p>Rotina ausente nesta versão.</p>
      </section>
    );
  const alvo = dados.sistema_id ?? dados.equipamento_id ?? dados.grupo_id;
  const tipoAlvo = { sistema: "Sistema", componente: "Componente", grupo: "Grupo Quantitativo" }[
    dados.alvo_tipo
  ];
  return (
    <section>
      <h4>{titulo}</h4>
      <strong>{dados.nome}</strong>
      <p>
        Alvo: {tipoAlvo} ({alvo})
      </p>
      <p>
        Modo: {dados.modo === "calendario" ? "Por calendário" : "Por Visita"}; recorrência:{" "}
        {dados.intervalo_n && dados.intervalo_unidade
          ? `${dados.intervalo_n} ${dados.intervalo_unidade}`
          : "não informada"}
        ; data-base: {dados.data_base ?? "não informada"}
      </p>
      <p>
        {dados.tempo_minutos && dados.tipo_tempo
          ? `${dados.tempo_minutos} min — ${dados.tipo_tempo === "total" ? "total" : "por unidade"}`
          : "Tempo a validar"}
      </p>
      <p>
        Tolerância: {dados.tolerancia_antes} antes e {dados.tolerancia_depois} depois (dias)
      </p>
      <p>Instrução: {dados.instrucao || "não informada"}</p>
      <p>Questionário: {dados.questionario_id ?? "não informado"}</p>
    </section>
  );
}
type Props = { userId: string; clienteId: string; planoId: string; revisao: number };
export function PreviaRevisionada(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.planoId,props.revisao])} {...props} />;
}
function Conteudo({
  userId,
  clienteId,
  planoId,
  revisao,
}: Props) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const consulta = useInfiniteQuery({
    queryKey: [
      ...planoManutencaoKeys.raiz(userId, clienteId),
      planoId,
      "previa-revisionada",
      revisao,
    ],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes=await supabase.auth.getUser();
      if(antes.error || antes.data.user?.id!==userId || signal.aborted)throw new Error("Sessão alterada.");
      const pagina=await supabasePlanoManutencaoAdapter.preverRevisaoRevisionada(
        planoId,
        revisao,
        20,
        pageParam,
        signal,
      );
      const depois=await supabase.auth.getUser();
      if(depois.error || depois.data.user?.id!==userId || signal.aborted)throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.nextCursor ?? undefined,
    gcTime: 0,
    retry: false,
  });
  const paginas = consulta.data?.pages ?? [];
  const primeira = paginas[0];
  const divergente = paginas.some(
    (p) =>
      p.revision !== revisao ||
      p.versaoAnteriorId !== primeira?.versaoAnteriorId ||
      p.versaoRascunhoId !== primeira?.versaoRascunhoId,
  );
  const itens = paginas.flatMap((p) => p.items);
  return (
    <section aria-label="Comparação da revisão" className="space-y-2">
      <p>
        Comparação informativa de conteúdo. Impactos em Ocorrências e OS não foram calculados; a
        aprovação da nova versão permanece bloqueada.
      </p>
      {import.meta.env.VITE_SSO_IMPACTO_REVISAO_OS_ENABLED === "true" && <DiagnosticoOsRevisao userId={userId} clienteId={clienteId} planoId={planoId} revisao={revisao} />}
      {import.meta.env.VITE_SSO_INDICIOS_REVISAO_ROTINA_ENABLED === "true" && <IndiciosRevisaoRotina userId={userId} clienteId={clienteId} planoId={planoId} revisao={revisao} />}
      {import.meta.env.VITE_SSO_DIAGNOSTICO_VIGENCIAS_ENABLED === "true" && <DiagnosticoVigencias userId={userId} clienteId={clienteId} planoId={planoId} revisao={revisao} />}
      {import.meta.env.VITE_SSO_DECISAO_IMPACTO_OCORRENCIA_ENABLED === "true" && <DecisaoImpactoOcorrencia userId={userId} clienteId={clienteId} planoId={planoId} revision={revisao} />}
      {import.meta.env.VITE_SSO_DECISAO_IMPACTO_VISITA_ENABLED === "true" && <DecisaoImpactoVisita userId={userId} clienteId={clienteId} planoId={planoId} revision={revisao} />}
      {consulta.isFetching && <output>Carregando comparação...</output>}
      {consulta.isError && (
        <p role="alert">
          Não foi possível comparar a revisão.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {divergente && (
        <p role="alert">O Plano mudou. Atualize os dados antes de consultar a comparação.</p>
      )}
      {!consulta.isFetching && !consulta.isError && !divergente && (
        <>
          {consulta.data && itens.length === 0 && <p>Nenhuma Rotina para comparar.</p>}
          <ul>
            {itens.map((item) => {
              const nome = item.rascunho?.nome ?? item.anterior?.nome ?? "Rotina";
              const descricao = {
                adicionada: "Adicionada",
                retirada: "Retirada",
                alterada: "Alterada",
                inalterada: "Inalterada",
                questionario_indeterminado: "Questionário não comparado",
              }[item.classificacao];
              return (
                <li key={item.rotinaLogicaId}>
                  {nome} — {descricao}
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setSelecionada(
                        selecionada === item.rotinaLogicaId ? null : item.rotinaLogicaId,
                      )
                    }
                  >
                    {selecionada === item.rotinaLogicaId
                      ? "Fechar detalhes"
                      : `Detalhes de ${nome}`}
                  </Button>
                  {selecionada === item.rotinaLogicaId && (
                    <div>
                      {item.questionarioConteudoPendente && (
                        <p>
                          O conteúdo do questionário não foi comparado; consulte o questionário
                          histórico separadamente.
                        </p>
                      )}
                      <Campos titulo="Versão aprovada" dados={item.anterior} />
                      <Campos titulo="Rascunho" dados={item.rascunho} />
                      {import.meta.env.VITE_SSO_COMPARACAO_QUESTIONARIO_ENABLED === "true" && <ComparacaoQuestionario userId={userId} clienteId={clienteId} planoId={planoId} revisao={revisao} rotinaId={item.rotinaLogicaId} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {consulta.hasNextPage && (
            <Button variant="secondary" onClick={() => void consulta.fetchNextPage()}>
              Mais resultados
            </Button>
          )}
        </>
      )}
    </section>
  );
}
