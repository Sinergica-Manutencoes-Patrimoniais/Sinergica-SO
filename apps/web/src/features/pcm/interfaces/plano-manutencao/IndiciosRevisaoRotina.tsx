import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
type Item = {
  rotinaLogicaId: string;
  classificacao: string;
  alvoAlterado: boolean | null;
  recorrenciaOuAncoraAlterada: boolean | null;
  osAbertasVinculadasParciais: number;
  questionarioConteudoPendente: boolean;
  ocorrenciasCalendarioPreparadas?: number;
  ocorrenciasCalendarioSemPonte?: number;
  ocorrenciasVisitaPreparadas?: number;
};

export function IndiciosRevisaoRotina({
  userId,
  clienteId,
  planoId,
  revisao,
}: { userId: string; clienteId: string; planoId: string; revisao: number }) {
  const [filtro, setFiltro] = useState("todos");
  const comOcorrencias = import.meta.env.VITE_SSO_OCORRENCIAS_REVISAO_ENABLED === "true";
  const lista = useInfiniteQuery({
    queryKey: ["indicios-revisao-rotina", userId, clienteId, planoId, revisao, comOcorrencias],
    initialPageParam: null as string | null,
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc(
          comOcorrencias ? "sso_ocorrencias_revisao_por_rotina" : "sso_indicios_revisao_por_rotina",
          {
            p_cliente_id: clienteId,
            p_plano_id: planoId,
            p_revisao: revisao,
            p_apos: pageParam,
            p_limite: 20,
          },
        )
        .abortSignal(signal);
      if (error) throw error;
      if (
        !data ||
        !Array.isArray(data.items) ||
        data.fontesIncompletas !== true ||
        data.impactoCalculado !== false ||
        data.aprovacaoAutorizada !== false
      )
        throw new Error("Prévia inválida.");
      return data as { items: Item[]; nextCursor: string | null };
    },
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const itens = (lista.data?.pages.flatMap((p) => p.items) ?? []).filter(
    (item) =>
      filtro === "todos" ||
      (filtro === "alvo" && item.alvoAlterado === true) ||
      (filtro === "recorrencia" && item.recorrenciaOuAncoraAlterada === true) ||
      (filtro === "os" && item.osAbertasVinculadasParciais > 0) ||
      (filtro === "outras" && ["adicionada", "retirada"].includes(item.classificacao)),
  );
  return (
    <section aria-label="Indícios por Rotina">
      <h4>Indícios por Rotina</h4>
      <p>
        Fontes parciais: OS somente de calendário com ponte; ocorrências incluem apenas registros
        preparados. Contagem zero não prova ausência de impacto; não calcula alterações operacionais
        nem autoriza aprovação. O filtro se aplica somente às páginas carregadas.
      </p>
      <label>
        Filtrar páginas carregadas{" "}
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todos">Todas</option>
          <option value="alvo">Alvo alterado</option>
          <option value="recorrencia">Recorrência ou âncora alterada</option>
          <option value="os">Com OS aberta encontrada</option>
          <option value="outras">Adicionadas ou retiradas</option>
        </select>
      </label>
      {lista.isError && (
        <p role="alert">
          Consulta indisponível ou revisão alterada.{" "}
          <button type="button" onClick={() => void lista.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {lista.isFetching && <p>Consultando…</p>}
      <ul>
        {itens.map((i) => (
          <li key={i.rotinaLogicaId}>
            Rotina {i.rotinaLogicaId} · {i.classificacao} · alvo{" "}
            {i.alvoAlterado === null
              ? "não comparável"
              : i.alvoAlterado
                ? "alterado"
                : "sem diferença encontrada"}{" "}
            · recorrência/âncora{" "}
            {i.recorrenciaOuAncoraAlterada === null
              ? "não comparável"
              : i.recorrenciaOuAncoraAlterada
                ? "alterada"
                : "sem diferença encontrada"}{" "}
            · OS abertas encontradas {i.osAbertasVinculadasParciais}
            {comOcorrencias &&
              ` · ocorrências calendário ${i.ocorrenciasCalendarioPreparadas ?? "indisponível"} (sem ponte ${i.ocorrenciasCalendarioSemPonte ?? "indisponível"}) · Visita ${i.ocorrenciasVisitaPreparadas ?? "indisponível"}`}
            {i.questionarioConteudoPendente && " · conteúdo do questionário pendente"}
          </li>
        ))}
      </ul>
      {lista.hasNextPage && (
        <button
          type="button"
          disabled={lista.isFetching}
          onClick={() => void lista.fetchNextPage()}
        >
          Mais Rotinas
        </button>
      )}
    </section>
  );
}
