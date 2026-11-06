import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

const count = z.number().int().nonnegative().safe();
const os = z.object({ osId: z.string().uuid(), status: z.string(), atualizadaEm: z.string() }).strict();
const item = z.object({
  chave: z.string(),
  modo: z.enum(["calendario", "visita"]),
  ocorrenciaId: z.string().uuid(),
  rotinaLogicaId: z.string().uuid(),
  rotinaAnteriorId: z.string().uuid(),
  alvoAnterior: z.object({ tipo: z.string(), id: z.string().uuid() }).strict(),
  alvoNovo: z.object({ tipo: z.string(), id: z.string().uuid().nullable() }).strict().nullable(),
  ciclo: count.nullable(),
  semanaOrigem: z.string().date(),
  vencimentoOriginal: z.string().date(),
  novoVencimento: z.string().date().nullable(),
  estadoQuestionario: z.enum(["sem_questionario", "comparacao_questionario_bloqueada", "conteudo_integral_igual", "conteudo_integral_diferente", "referencia_alterada", "historico_indeterminado", "fonte_atual_indisponivel", "nao_comparavel"]),
  classificacao: z.enum(["manter", "alterar", "retirar", "indeterminada"]),
  ponteLegadaComprovada: z.boolean(),
  ocorrenciaLegadaId: z.string().uuid().nullable(),
  osAbertasComPonteComprovada: z.array(os).max(101),
  fontesDesconhecidas: z.boolean(),
  osClienteDivergente: z.boolean(),
}).strict();
const receipt = z.object({
  revision: z.number().int().positive(),
  versaoAnteriorId: z.string().uuid(),
  versaoRascunhoId: z.string().uuid(),
  nextCursor: z.string().nullable(),
  limite: z.number().int().positive(),
  ocorrencias: z.array(item).max(50),
  ocorrenciasObservadas: count,
  aManter: count,
  aAlterar: count,
  aRetirar: count,
  indeterminadas: count,
  comFontesDesconhecidas: count,
  osAbertasComPonteComprovada: count,
  osClienteDivergente: count,
  visitasSemPonteLegada: count.nullable(),
  planosLegadosSemRelacaoDeclarada: count.nullable(),
  legadasSemPonteObservada: count.nullable(),
  fontesIncompletas: z.boolean(),
  impactoIntegralComprovado: z.boolean(),
  confirmacaoBloqueada: z.boolean(),
  motivosBloqueio: z.array(z.string()),
  aprovacaoAutorizada: z.literal(false),
}).passthrough();
export type EstadoReciboReconciliacao = "carregando" | "bloqueado" | "indisponivel" | "liberado";
type Props = { userId: string; clienteId: string; planoId: string; revisao: number; vigencia: string; onEstadoChange?: (estado: EstadoReciboReconciliacao) => void };

export function ReciboReconciliacaoRevisao({ userId, clienteId, planoId, revisao, vigencia, onEstadoChange }: Props) {
  const consulta = useInfiniteQuery({
    queryKey: ["recibo-reconciliacao-revisao", userId, clienteId, planoId, revisao, vigencia],
    initialPageParam: null as string | null,
    gcTime: 0,
    retry: false,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_recibo_reconciliacao_revisao_mediado", {
        p_ator: userId,
        p_cliente: clienteId,
        p_plano: planoId,
        p_revisao: revisao,
        p_vigencia: vigencia,
        p_apos: pageParam,
        p_limite: 20,
      }).abortSignal(signal);
      if (error) throw error;
      const result = receipt.parse(data);
      if (result.revision !== revisao) throw new Error("Recibo de outra revisão.");
      await conferirSessaoDiagnostico(userId, signal);
      return result;
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const pages = consulta.data?.pages ?? [];
  const first = pages[0];
  const resumo = pages[pages.length - 1] ?? first;
  const drift = pages.some((page) => page.versaoAnteriorId !== first?.versaoAnteriorId || page.versaoRascunhoId !== first?.versaoRascunhoId);
  const items = pages.flatMap((page) => page.ocorrencias);
  useEffect(() => {
    if (!onEstadoChange) return;
    if (consulta.isError || drift) onEstadoChange("indisponivel");
    else if (!first || consulta.isFetching) onEstadoChange("carregando");
    else if (consulta.hasNextPage || resumo?.confirmacaoBloqueada || resumo?.fontesIncompletas || !resumo?.impactoIntegralComprovado || resumo?.comFontesDesconhecidas > 0 || resumo?.indeterminadas > 0 || resumo?.osClienteDivergente > 0) onEstadoChange("bloqueado");
    else onEstadoChange("liberado");
  }, [consulta.hasNextPage, consulta.isError, consulta.isFetching, drift, first, resumo, onEstadoChange]);
  return (
    <section aria-label="Recibo de reconciliação da revisão">
      <h4>Recibo de reconciliação</h4>
      <p>Fotografia paginada da revisão {revisao}. As páginas podem refletir mudanças posteriores; a confirmação revalida no servidor. A consulta não altera ocorrências, OS ou vigências.</p>
      {consulta.isFetching && <output>Consultando ocorrências, pontes e OS abertas…</output>}
      {consulta.isError && <p role="alert">Recibo indisponível ou revisão alterada. Confirmação bloqueada.</p>}
      {drift && <p role="alert">As versões mudaram durante a consulta. Atualize antes de continuar.</p>}
      {!consulta.isError && first && !drift && (
        <>
          <p role="status">
            {resumo?.confirmacaoBloqueada ? `Confirmação bloqueada: ${resumo.motivosBloqueio.join(", ")}.` : "Reconciliação integral carregada; confirmação sujeita à revalidação no servidor."} Mantidas {resumo?.aManter ?? first.aManter} · alteradas {resumo?.aAlterar ?? first.aAlterar} · retiradas {resumo?.aRetirar ?? first.aRetirar} · indeterminadas {resumo?.indeterminadas ?? first.indeterminadas} · com fontes desconhecidas {resumo?.comFontesDesconhecidas ?? first.comFontesDesconhecidas} · OS abertas por ponte comprovada {resumo?.osAbertasComPonteComprovada ?? first.osAbertasComPonteComprovada} · divergências de Cliente {resumo?.osClienteDivergente ?? first.osClienteDivergente}.
          </p>
          <p>Visitas sem ponte {resumo?.visitasSemPonteLegada ?? "indeterminado"} · Planos legados sem classificação {resumo?.planosLegadosSemRelacaoDeclarada ?? "indeterminado"} · ocorrências legadas sem ponte {resumo?.legadasSemPonteObservada ?? "indeterminado"}.</p>
          <p>Impacto integral comprovado: {resumo?.impactoIntegralComprovado ? "sim" : "não"}. Ausência de impacto não comprovada enquanto a reconciliação estiver bloqueada. OS sem ponte não são tratadas como inexistentes.</p>
          {items.length === 0 && <p>Nenhuma ocorrência preparada no snapshot anterior.</p>}
          <ul>
            {items.map((entry) => (
              <li key={entry.chave}>
                {entry.modo} · {entry.classificacao} · alvo {entry.alvoAnterior.tipo} {entry.alvoAnterior.id} · ciclo {entry.ciclo ?? entry.semanaOrigem} · vencimento {entry.vencimentoOriginal}
                {entry.alvoNovo && ` → alvo ${entry.alvoNovo.tipo} ${entry.alvoNovo.id ?? "indeterminado"}`}
                {entry.novoVencimento && ` → ${entry.novoVencimento}`}
                {entry.estadoQuestionario !== "sem_questionario" && ` · questionário ${entry.estadoQuestionario}`}
                {entry.fontesDesconhecidas && <strong> · impacto desconhecido: ponte ou identidade ausente</strong>}
                {entry.osClienteDivergente && <strong> · OS de outro Cliente: bloqueio</strong>}
                {entry.osAbertasComPonteComprovada.map((ordem) => (
                  <span key={ordem.osId}> · OS aberta {ordem.osId} ({ordem.status})</span>
                ))}
              </li>
            ))}
          </ul>
          {consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais ocorrências</button>}
        </>
      )}
    </section>
  );
}
