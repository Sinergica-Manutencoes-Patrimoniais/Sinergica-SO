import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { consolidarEsforcoVisitas } from "../../domain/consolidar-esforco-visitas";
import { consolidarEsforcoContinuacoes } from "../../domain/consolidar-esforco-continuacoes";
import { EscopoDeclarado } from "./EscopoDeclarado";
import { EsforcoDeclarado } from "./EsforcoDeclarado";
import { DeslocamentoDeclarado } from "./DeslocamentoDeclarado";
import { DeslocamentosSemana } from "./DeslocamentosSemana";
import { ConfirmarEsforcoRestante } from "./ConfirmarEsforcoRestante";

type Fonte = {
  vinculo_id: string;
  visita_id: string;
  os_id: string;
  os_status: string;
  ocorrencia_legada_id: string | null;
  ocorrencia_preparada_id: string | null;
  ciclo_id: string | null;
  inicio_em: string;
  fuso: string;
  estimativa_os_minutos: number | null;
  participantes: number;
  deslocamento_visita_minutos: number | null;
  completude: string;
  esforco_revision?: number;
  internos_minutos?: number | null;
  terceiros_minutos?: number | null;
  acompanhamento_minutos?: number | null;
  proposta_continuacao_id?: string | null;
  minutos_continuacao?: number | null;
  esforco_restante_confirmado?: boolean;
};
export function FontesDemanda({
  userId,
  clienteId,
  semana,
}: { userId: string; clienteId: string; semana: string }) {
  const [osEditada, setOsEditada] = useState<string | null>(null);
  const [escopoEditado, setEscopoEditado] = useState<string | null>(null);
  const [visitaDeslocamento, setVisitaDeslocamento] = useState<string | null>(null);
  const mostrarResumo = import.meta.env.VITE_SSO_RESUMO_ESFORCO_ENABLED === "true";
  const mostrarContinuacoes = mostrarResumo && import.meta.env.VITE_SSO_ESFORCO_CONTINUACAO_ENABLED === "true";
  const confirmarRestante = mostrarContinuacoes && import.meta.env.VITE_SSO_ESFORCO_RESTANTE_CONTINUACAO_ENABLED === "true";
  const fontes = useInfiniteQuery({
    queryKey: ["capacidade-fontes-demanda", userId, clienteId, semana, mostrarResumo, mostrarContinuacoes, confirmarRestante],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc(
          confirmarRestante ? "sso_fontes_esforco_restante" : mostrarContinuacoes ? "sso_fontes_esforco_continuacao" : mostrarResumo ? "sso_fontes_esforco_autorizadas" : "sso_fontes_demanda_autorizadas",
          {
            p_cliente_id: clienteId,
            p_semana_inicio: semana,
            p_apos: pageParam,
            p_limite: 50,
          },
        )
        .abortSignal(signal);
      if (error) throw error;
      if (
        !Array.isArray(data) || data.length > 50 ||
        data.some(
          (f) =>
            typeof f.vinculo_id !== "string" ||
            typeof f.visita_id !== "string" ||
            typeof f.os_id !== "string" ||
            typeof f.os_status !== "string" ||
            (f.ocorrencia_legada_id !== null && typeof f.ocorrencia_legada_id !== "string") ||
            (f.ocorrencia_preparada_id !== null && typeof f.ocorrencia_preparada_id !== "string") ||
            (f.ciclo_id != null && (typeof f.ciclo_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(f.ciclo_id))) ||
            typeof f.inicio_em !== "string" ||
            typeof f.fuso !== "string" ||
            !Number.isSafeInteger(f.participantes) || f.participantes < 0 ||
            (f.estimativa_os_minutos !== null && (!Number.isSafeInteger(f.estimativa_os_minutos) || f.estimativa_os_minutos < 0)) ||
            (f.deslocamento_visita_minutos !== null && (!Number.isSafeInteger(f.deslocamento_visita_minutos) || f.deslocamento_visita_minutos < 0)) ||
            (mostrarContinuacoes && ((f.proposta_continuacao_id === null) !== (f.minutos_continuacao === null) ||
              (f.proposta_continuacao_id !== null && (typeof f.proposta_continuacao_id !== "string" || !Number.isSafeInteger(f.minutos_continuacao) || f.minutos_continuacao < 1)))) ||
            (confirmarRestante && (typeof f.esforco_restante_confirmado !== "boolean" || (f.esforco_restante_confirmado && f.proposta_continuacao_id === null))) ||
            (mostrarResumo &&
              (!Number.isSafeInteger(f.esforco_revision) ||
                f.esforco_revision < 0 ||
                [f.internos_minutos, f.terceiros_minutos, f.acompanhamento_minutos].some(
                  (n) => n !== null && (!Number.isSafeInteger(n) || n < 0),
                ))),
        )
      )
        throw new Error("Fontes inválidas.");
      let anterior = pageParam?.toLowerCase() ?? null;
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const fonte of data as Fonte[]) {
        const id = fonte.vinculo_id.toLowerCase();
        if (!uuid.test(id) || !uuid.test(fonte.visita_id) || !uuid.test(fonte.os_id) || (anterior !== null && id <= anterior)) throw new Error("Paginação de fontes inválida.");
        anterior = id;
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return data as Fonte[];
    },
    getNextPageParam: (pagina) => (pagina.length === 50 ? pagina.at(-1)?.vinculo_id : undefined),
  });
  const grupos = new Map<string, Fonte[]>();
  const linhasConsultadas = !fontes.isFetching && !fontes.isError ? (fontes.data?.pages.flat() ?? []) : [];
  const paginasDivergentes = linhasConsultadas.some((f, i) => i > 0 && f.vinculo_id.toLowerCase() <= linhasConsultadas[i - 1]!.vinculo_id.toLowerCase());
  const linhasCarregadas = paginasDivergentes ? [] : linhasConsultadas;
  let resumo: ReturnType<typeof consolidarEsforcoVisitas> | null = null;
  let continuacoes: ReturnType<typeof consolidarEsforcoContinuacoes> | null = null;
  if (mostrarResumo && linhasCarregadas.length) {
    try {
      resumo = consolidarEsforcoVisitas(
        linhasCarregadas.map((f) => ({
          osId: f.os_id,
          continuidade: mostrarContinuacoes && f.proposta_continuacao_id != null && !(confirmarRestante && f.esforco_restante_confirmado),
          podeSomar: [
            "solicitacao",
            "corretiva",
            "backlog",
            "planejamento",
            "em_execucao",
          ].includes(f.os_status),
          ocorrenciaIds: [
            f.ocorrencia_legada_id ? `legada:${f.ocorrencia_legada_id}` : null,
            f.ocorrencia_preparada_id ? `preparada:${f.ocorrencia_preparada_id}` : null,
            f.ciclo_id ? `ciclo:${f.ciclo_id}` : null,
          ].filter((id): id is string => id !== null),
          ocorrenciaId: f.ocorrencia_legada_id
            ? `legada:${f.ocorrencia_legada_id}`
            : f.ocorrencia_preparada_id
              ? `preparada:${f.ocorrencia_preparada_id}`
              : null,
          revision: f.esforco_revision ?? -1,
          internosMinutos: f.internos_minutos ?? null,
          terceirosMinutos: f.terceiros_minutos ?? null,
          acompanhamentoMinutos: f.acompanhamento_minutos ?? null,
        })),
      );
    } catch {
      resumo = null;
    }
  }
  if (mostrarContinuacoes && linhasCarregadas.length) {
    try {
      continuacoes = consolidarEsforcoContinuacoes(linhasCarregadas.map((f) => ({
        osId: f.os_id, propostaId: f.proposta_continuacao_id ?? null, minutos: f.minutos_continuacao ?? null,
        podeSomar: ["solicitacao", "corretiva", "backlog", "planejamento", "em_execucao"].includes(f.os_status),
      })));
    } catch { continuacoes = null; }
  }
  if (!fontes.isFetching && !fontes.isError && !paginasDivergentes)
    for (const fonte of linhasCarregadas) {
      const grupo = grupos.get(fonte.visita_id) ?? [];
      grupo.push(fonte);
      grupos.set(fonte.visita_id, grupo);
    }
  // Duração declarada é distinta de HH: a contagem de participantes não
  // identifica quais pessoas se deslocam nem se são equipe interna.
  let deslocamentoMinutos = 0;
  let deslocamentosPendentes = 0;
  let deslocamentosConflitantes = 0;
  let deslocamentoSeguro = true;
  for (const linhas of grupos.values()) {
    const primeira = linhas[0];
    if (!primeira) continue;
    if (linhas.some((f) => f.deslocamento_visita_minutos !== primeira.deslocamento_visita_minutos)) {
      deslocamentosConflitantes++;
    } else if (primeira.deslocamento_visita_minutos === null) {
      deslocamentosPendentes++;
    } else {
      deslocamentoMinutos += primeira.deslocamento_visita_minutos;
      if (!Number.isSafeInteger(deslocamentoMinutos)) deslocamentoSeguro = false;
    }
  }
  return (
    <section aria-label="Fontes de demanda da semana">
      <h3>Fontes de demanda da semana</h3>
      {import.meta.env.VITE_SSO_DESLOCAMENTOS_SEMANA_ENABLED === "true" && <DeslocamentosSemana key={JSON.stringify([userId, clienteId, semana])} userId={userId} clienteId={clienteId} semana={semana} />}
      <p>
        Somente vínculos de Visita carregados. Não há capacidade validada: esforço restante,
        deduplicação OS/Ocorrência, simultaneidade e especialidades ainda dependem de conferência.
        Deslocamento aparece uma vez por Visita, sem multiplicação por OS.
      </p>
      {grupos.size > 0 && <div>
        {deslocamentoSeguro ? <p>Duração de deslocamento declarada nas Visitas carregadas: {deslocamentoMinutos} minutos; {deslocamentosPendentes} sem valor e {deslocamentosConflitantes} com valores divergentes excluídas.</p>
          : <p role="alert">Subtotal de deslocamento indisponível por limite de precisão.</p>}
        <p>Cada Visita é contada uma vez. Duração não é horas-homem, não identifica equipe própria e não está somada à demanda interna; fontes incompletas podem alterar o subtotal.</p>
      </div>}
      {mostrarResumo &&
        linhasCarregadas.length > 0 &&
        (resumo ? (
          <div>
            <p>
              Interno declarado: {resumo.internosMinutos} minutos-homem (inclui acompanhamento).
            </p>
            <p>Terceiros declarados: {resumo.terceirosMinutos} minutos-homem.</p>
            <p>
              Da equipe própria: {resumo.execucaoPropriaMinutos} minutos de execução e{" "}
              {resumo.acompanhamentoMinutos} minutos de acompanhamento; já incluídos no interno.
            </p>
            {resumo.estimativasIncompletas > 0 && (
              <p role="status">
                {resumo.estimativasIncompletas} fonte(s) com estimativa ausente ou totalmente zerada; os
                subtotais não representam demanda completa.
              </p>
            )}
            {(resumo.continuacoesPendentes ?? 0) > 0 && <p>Continuidade sem HH restantes identificadas: {resumo.continuacoesPendentes} OS excluída(s) do subtotal até conferência.</p>}
            <p>
              Origens pendentes: {resumo.origensPendentes}; conflitantes:{" "}
              {resumo.origensConflitantes}.
            </p>
            {resumo.origensConflitantes > 0 && (
              <p>
                OS com origem compartilhada ou dados divergentes foram excluídas do subtotal até
                conferência.
              </p>
            )}
            <p>
              Não representa demanda completa nem saldo: somente OS carregadas, sem ocorrências não
              vinculadas ou deduplicação OS/ocorrência.
            </p>
            <p>
              Declarações de escopo e HH não comprovam execução ou esforço restante; todas as
              origens seguem pendentes.
            </p>
          </div>
        ) : (
          <p role="alert">Subtotal indisponível: dados inconsistentes.</p>
        ))}
      {mostrarContinuacoes && linhasCarregadas.length > 0 && (continuacoes ? <div>
        <p>Continuações carregadas: {continuacoes.ordens} OS, {continuacoes.minutos} minutos restantes declarados; {continuacoes.conflitos} OS com dados conflitantes excluídas.</p>
        <p>Subtotal separado dos HH declarados para evitar dupla contagem; não representa capacidade disponível ou execução.</p>
      </div> : <p role="alert">Subtotal de continuidades indisponível: dados inconsistentes.</p>)}
      {fontes.isFetching && <output>Carregando fontes…</output>}
      {fontes.isError && (
        <p role="alert">
          Fontes indisponíveis.{" "}
          <button type="button" onClick={() => void fontes.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!fontes.isFetching && !fontes.isError && paginasDivergentes && (
        <p role="alert">As páginas de fontes divergiram. <button type="button" onClick={() => void fontes.refetch()}>Consultar novamente</button></p>
      )}
      {!fontes.isFetching && !fontes.isError && fontes.data?.pages.flat().length === 0 && (
        <p>Nenhuma fonte nesta página; isso não prova demanda zero.</p>
      )}
      <ul>
        {[...grupos.entries()].map(([visitaId, linhas]) => {
          const primeira = linhas[0];
          if (!primeira) return null;
          const contextoConsistente = linhas.every((f) => f.inicio_em === primeira.inicio_em && f.fuso === primeira.fuso &&
            f.participantes === primeira.participantes && f.deslocamento_visita_minutos === primeira.deslocamento_visita_minutos);
          return (
            <li key={visitaId}>
              Visita {visitaId} · {contextoConsistente ? <>{primeira.inicio_em} ({primeira.fuso}) · {primeira.participantes}{" "}
                participante(s) · deslocamento{" "}
                {primeira.deslocamento_visita_minutos === null ? "não informado" : `${primeira.deslocamento_visita_minutos} min`}</> :
                <span role="alert">informações da Visita divergentes entre páginas; recarregue e confira antes de usar.</span>}
              {import.meta.env.VITE_SSO_DESLOCAMENTO_DECLARADO_ENABLED === "true" && <>
                <button type="button" aria-expanded={visitaDeslocamento === visitaId} onClick={() => setVisitaDeslocamento(visitaDeslocamento === visitaId ? null : visitaId)}>{visitaDeslocamento === visitaId ? "Ocultar deslocamento declarado" : "Conferir deslocamento declarado"}</button>
                {visitaDeslocamento === visitaId && <DeslocamentoDeclarado userId={userId} clienteId={clienteId} visitaId={visitaId} />}
              </>}
              <ul>
                {linhas.map((f) => (
                  <li key={f.vinculo_id}>
                    OS {f.os_id} · {f.os_status} · estimativa{" "}
                    {f.estimativa_os_minutos === null
                      ? "pendente"
                      : f.estimativa_os_minutos === 0
                        ? "pendente (zero informado)"
                        : `${f.estimativa_os_minutos} min informados`}{" "}
                    · ocorrência {f.ocorrencia_legada_id ?? "não vinculada"} · ciclo{" "}
                    {f.ciclo_id ?? "não comprovado"} · completude {f.completude}
                    {mostrarContinuacoes && f.proposta_continuacao_id && <> · continuidade: {f.minutos_continuacao} min restantes declarados</>}
                    {confirmarRestante && f.proposta_continuacao_id && f.esforco_restante_confirmado && <> · HH restantes confirmadas nesta revisão</>}
                    {confirmarRestante && f.proposta_continuacao_id && <ConfirmarEsforcoRestante
                      userId={userId} clienteId={clienteId} osId={f.os_id} propostaId={f.proposta_continuacao_id}
                      revisao={f.esforco_revision ?? 0} internos={f.internos_minutos ?? null} terceiros={f.terceiros_minutos ?? null} acompanhamento={f.acompanhamento_minutos ?? null} jaConfirmado={f.esforco_restante_confirmado === true} />}
                    {import.meta.env.VITE_SSO_ESFORCO_DECLARADO_ENABLED === "true" && (
                      <button
                        type="button"
                        onClick={() =>
                          setOsEditada(osEditada === f.vinculo_id ? null : f.vinculo_id)
                        }
                      >
                        Declarar esforço desta OS
                      </button>
                    )}
                    {osEditada === f.vinculo_id &&
                      import.meta.env.VITE_SSO_ESFORCO_DECLARADO_ENABLED === "true" && (
                        <EsforcoDeclarado
                          key={f.vinculo_id}
                          userId={userId}
                          clienteId={clienteId}
                          osId={f.os_id}
                        />
                      )}
                    {import.meta.env.VITE_SSO_ESCOPO_ORIGEM_ENABLED === "true" && (
                      <button
                        type="button"
                        onClick={() =>
                          setEscopoEditado(escopoEditado === f.vinculo_id ? null : f.vinculo_id)
                        }
                      >
                        Declarar escopo desta OS
                      </button>
                    )}
                    {escopoEditado === f.vinculo_id &&
                      import.meta.env.VITE_SSO_ESCOPO_ORIGEM_ENABLED === "true" && (
                        <EscopoDeclarado
                          key={f.vinculo_id}
                          userId={userId}
                          clienteId={clienteId}
                          osId={f.os_id}
                        />
                      )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {fontes.hasNextPage && !paginasDivergentes && (
        <button type="button" onClick={() => void fontes.fetchNextPage()}>
          Mais fontes
        </button>
      )}
      {fontes.hasNextPage && !paginasDivergentes && (
        <p>Lista parcial: carregue todas as páginas para conferir os vínculos exibidos.</p>
      )}
    </section>
  );
}
