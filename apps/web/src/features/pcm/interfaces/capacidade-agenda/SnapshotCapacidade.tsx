import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { consolidarEsforcoVisitas, identificarConflitosEsforco, type EsforcoVisita } from "../../domain/consolidar-esforco-visitas";
import { chaveIdentidade } from "../../domain/capacidade-por-tecnico";

const minutos = z.number().int().nonnegative().nullable();
function dataCivil(valor: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith("0000")) return Number.NaN;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor ? data.getTime() : Number.NaN;
}
const estimativa = {
  esforco_revision: z.number().int().nonnegative(),
  internos_minutos: minutos,
  terceiros_minutos: minutos,
  acompanhamento_minutos: minutos,
};
const snapshot = z.object({
  clienteId: z.string(),
  semanaInicio: z.string(),
  completude: z.literal("desconhecida"),
  limiteFontesAtingido: z.boolean(),
  limiteOcorrenciasAtingido: z.boolean(),
  fontesVisita: z
    .array(
      z.object({
        os_id: z.string().min(1),
        os_status: z.string(),
        prova_finalizacao_pcm: z
          .enum(["indisponivel", "nao_registrada", "finalizacao_pcm_registrada"])
          .optional(),
        ocorrencia_legada_id: z.string().nullable(),
        ocorrencia_preparada_id: z.string().nullable(),
        ciclo_id: z.string().guid().nullable().optional(),
        ...estimativa,
      }),
    )
    .max(100),
  ocorrenciasSemOs: z
    .array(
      z.object({
        tipo: z.enum(["calendario", "visita"]),
        ocorrencia_id: z.string().min(1),
        vencimento_original: z.string().optional(),
        data_referencia: z.string().optional(),
        ciclo_id: z.string().guid().nullable().optional(),
        ...estimativa,
      }),
    )
    .max(100),
});
const snapshotV2 = snapshot.extend({
  limiteOsSemVisitaAtingido: z.boolean(),
  pendentesSemSemana: z.number().int().nonnegative(),
  osSemVisita: z
    .array(
      z.object({
        os_id: z.string().min(1),
        os_status: z.string(),
        data_referencia: z.string(),
        tipo: z.enum(["calendario", "visita"]).nullable(),
        origem_id: z.string().nullable(),
        ocorrencia_legada_id: z.string().nullable(),
        ciclo_id: z.string().guid().nullable().optional(),
        ...estimativa,
      }),
    )
    .max(100),
});
const snapshotV4 = snapshotV2.extend({
  limiteDisponibilidadesAtingido: z.boolean(),
  disponibilidades: z
    .array(
      z.object({
        id: z.string().min(1),
        funcionario_id: z.string().min(1),
        semana_inicio: z.string(),
        revisao: z.number().int().positive(),
        destinados_minutos: z.number().int().nonnegative().safe(),
        reservas_minutos: z.number().int().nonnegative().safe(),
        ausencias_minutos: z.number().int().nonnegative().safe(),
      }),
    )
    .max(100),
});
const snapshotV5 = snapshotV4.extend({
  limiteVinculosIntervaloAtingido: z.boolean(),
  vinculosIntervalo: z
    .array(
      z.object({
        disponibilidade_id: z.string().min(1),
        intervalo_id: z.string().min(1),
        tipo: z.enum(["reserva", "ausencia"]),
        revisao_vinculo: z.number().int().positive(),
        incluido: z.boolean(),
      }),
    )
    .max(100),
});
export function SnapshotCapacidade({
  userId,
  clienteId,
  semana,
  aoUsarParcial,
}: { userId: string; clienteId: string; semana: string; aoUsarParcial?: (dados: { semana: string; disponibilidade: number; demanda: number }) => void }) {
  const [filtroTecnico, setFiltroTecnico] = useState<{ contexto: string; id: string } | null>(null);
  const contexto = JSON.stringify([userId, clienteId, semana]);
  const usarCiclos = import.meta.env.VITE_SSO_SNAPSHOT_CAPACIDADE_CICLOS_ENABLED === "true";
  const usarReferencia = usarCiclos || import.meta.env.VITE_SSO_SNAPSHOT_CAPACIDADE_REFERENCIA_ENABLED === "true";
  const usarV5 = usarReferencia || import.meta.env.VITE_SSO_SNAPSHOT_CAPACIDADE_V5_ENABLED === "true";
  const usarV4 = usarV5 || import.meta.env.VITE_SSO_SNAPSHOT_CAPACIDADE_V4_ENABLED === "true";
  const usarV3 = usarV4 || import.meta.env.VITE_SSO_SNAPSHOT_CAPACIDADE_V3_ENABLED === "true";
  const usarV2 = usarV3 || import.meta.env.VITE_SSO_SNAPSHOT_CAPACIDADE_V2_ENABLED === "true";
  const q = useQuery({
    queryKey: ["capacidade-snapshot", userId, clienteId, semana, usarV2, usarV3, usarV4, usarV5, usarReferencia, usarCiclos],
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc(
          usarCiclos ? "sso_snapshot_capacidade_ciclos" : usarReferencia ? "sso_snapshot_capacidade_referencia" : "sso_snapshot_capacidade_autorizado",
          usarReferencia ? { p_cliente_id: clienteId, p_semana_inicio: semana } : {
            p_cliente_id: clienteId, p_semana_inicio: semana,
            p_versao: usarV5 ? 5 : usarV4 ? 4 : usarV3 ? 3 : usarV2 ? 2 : 1,
          },
        )
        .abortSignal(signal);
      if (error) throw error;
      if (usarReferencia) z.object({ referenciaVisita: z.literal("programacao_ou_vencimento"), fotografiaTransacional: z.literal(false) }).passthrough().parse(data);
      if (usarCiclos) z.object({ identidadeCicloParcial: z.literal(true) }).passthrough().parse(data);
      const r = usarV5
        ? snapshotV5.parse(data)
        : usarV4
          ? {
              ...snapshotV4.parse(data),
              vinculosIntervalo: [],
              limiteVinculosIntervaloAtingido: false,
            }
          : usarV2
            ? {
                ...snapshotV2.parse(data),
                vinculosIntervalo: [],
                limiteVinculosIntervaloAtingido: false,
                disponibilidades: [],
                limiteDisponibilidadesAtingido: false,
              }
            : {
                ...snapshot.parse(data),
                vinculosIntervalo: [],
                limiteVinculosIntervaloAtingido: false,
                disponibilidades: [],
                limiteDisponibilidadesAtingido: false,
                osSemVisita: [],
                limiteOsSemVisitaAtingido: false,
                pendentesSemSemana: 0,
              };
      const inicio = dataCivil(semana);
      if (
        !Number.isFinite(inicio) || new Date(inicio).getUTCDay() !== 1 ||
        r.osSemVisita.some((f) => {
          const dia = dataCivil(f.data_referencia);
          return !Number.isFinite(dia) || dia < inicio || dia >= inicio + 7 * 86_400_000;
        }) ||
        (usarReferencia && r.ocorrenciasSemOs.some((f) => {
          const referencia = dataCivil(f.data_referencia ?? ""); const vencimento = dataCivil(f.vencimento_original ?? "");
          return !Number.isFinite(referencia) || !Number.isFinite(vencimento) || referencia < inicio || referencia >= inicio + 7 * 86_400_000 ||
            (f.tipo === "calendario" && referencia !== vencimento);
        })) ||
        r.clienteId !== clienteId ||
        r.semanaInicio !== semana ||
        (usarCiclos && [...r.fontesVisita, ...r.ocorrenciasSemOs, ...r.osSemVisita].some((f) => f.ciclo_id === undefined)) ||
        (r.fontesVisita.length === 100) !== r.limiteFontesAtingido ||
        (r.ocorrenciasSemOs.length === 100) !== r.limiteOcorrenciasAtingido ||
        (r.osSemVisita.length === 100) !== r.limiteOsSemVisitaAtingido ||
        (r.disponibilidades.length === 100) !== r.limiteDisponibilidadesAtingido ||
        (r.vinculosIntervalo.length === 100) !== r.limiteVinculosIntervaloAtingido ||
        new Set(r.vinculosIntervalo.map((v) => chaveIdentidade(v.intervalo_id))).size !==
          r.vinculosIntervalo.length ||
        r.vinculosIntervalo.some(
          (v) => !r.disponibilidades.some((d) => chaveIdentidade(d.id) === chaveIdentidade(v.disponibilidade_id)),
        ) ||
        new Set(r.disponibilidades.map((d) => chaveIdentidade(d.id))).size !== r.disponibilidades.length ||
        new Set(r.disponibilidades.map((d) => chaveIdentidade(d.funcionario_id))).size !==
          r.disponibilidades.length ||
        r.disponibilidades.some(
          (d) =>
            d.semana_inicio !== semana ||
            d.reservas_minutos + d.ausencias_minutos > d.destinados_minutos,
        ) ||
        (usarV3 && r.fontesVisita.some((f) => f.prova_finalizacao_pcm === undefined))
      )
        throw new Error("Snapshot divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return r;
    },
  });
  if (q.isPending || q.isFetching) return <output>Carregando snapshot…</output>;
  if (q.isError)
    return (
      <p role="alert">
        Snapshot indisponível.{" "}
        <button type="button" onClick={() => void q.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  let resumo: ReturnType<typeof consolidarEsforcoVisitas> | null = null;
  let conflitos: ReturnType<typeof identificarConflitosEsforco> = [];
  const disponibilidade = q.data.disponibilidades.reduce(
    (total, d) => total + d.destinados_minutos - d.reservas_minutos - d.ausencias_minutos,
    0,
  );
  const tecnicoSelecionado = filtroTecnico?.contexto === contexto ? filtroTecnico.id : "";
  const disponibilidadesExibidas = tecnicoSelecionado
    ? q.data.disponibilidades.filter((d) => chaveIdentidade(d.funcionario_id) === chaveIdentidade(tecnicoSelecionado))
    : q.data.disponibilidades;
  try {
    const fontes: EsforcoVisita[] = [
      ...q.data.fontesVisita.map((f) => ({
        osId: `os:${f.os_id}`,
        podeSomar: ["solicitacao", "corretiva", "backlog", "planejamento", "em_execucao"].includes(
          f.os_status,
        ),
        ocorrenciaIds: [
          f.ocorrencia_legada_id ? `legada:${f.ocorrencia_legada_id}` : null,
          f.ocorrencia_preparada_id ? `calendario:${f.ocorrencia_preparada_id}` : null,
          f.ciclo_id ? `ciclo:${f.ciclo_id}` : null,
        ].filter((id): id is string => id !== null),
        ocorrenciaId: f.ocorrencia_preparada_id
          ? `calendario:${f.ocorrencia_preparada_id}`
          : f.ocorrencia_legada_id
            ? `legada:${f.ocorrencia_legada_id}`
            : null,
        revision: f.esforco_revision,
        internosMinutos: f.internos_minutos,
        terceirosMinutos: f.terceiros_minutos,
        acompanhamentoMinutos: f.acompanhamento_minutos,
      })),
      ...q.data.ocorrenciasSemOs.map((f) => ({
        osId: `ocorrencia:${f.tipo}:${f.ocorrencia_id}`,
        ocorrenciaId: `${f.tipo}:${f.ocorrencia_id}`,
        ocorrenciaIds: f.ciclo_id ? [`ciclo:${f.ciclo_id}`] : [],
        revision: f.esforco_revision,
        internosMinutos: f.internos_minutos,
        terceirosMinutos: f.terceiros_minutos,
        acompanhamentoMinutos: f.acompanhamento_minutos,
      })),
      ...q.data.osSemVisita.map((f) => ({
        osId: `os:${f.os_id}`,
        podeSomar: ["solicitacao", "corretiva", "backlog", "planejamento", "em_execucao"].includes(
          f.os_status,
        ),
        ocorrenciaIds: [
          f.ocorrencia_legada_id ? `legada:${f.ocorrencia_legada_id}` : null,
          f.origem_id && f.tipo ? `${f.tipo}:${f.origem_id}` : null,
          f.ciclo_id ? `ciclo:${f.ciclo_id}` : null,
        ].filter((id): id is string => id !== null),
        ocorrenciaId:
          f.origem_id && f.tipo
            ? `${f.tipo}:${f.origem_id}`
            : f.ocorrencia_legada_id
              ? `legada:${f.ocorrencia_legada_id}`
              : null,
        revision: f.esforco_revision,
        internosMinutos: f.internos_minutos,
        terceirosMinutos: f.terceiros_minutos,
        acompanhamentoMinutos: f.acompanhamento_minutos,
      })),
    ];
    resumo = consolidarEsforcoVisitas(fontes);
    conflitos = identificarConflitosEsforco(fontes);
  } catch {
    resumo = null;
  }
  return (
    <section aria-label="Snapshot parcial de capacidade">
      <h3>Snapshot parcial da semana</h3>
      <p>
        {usarReferencia ? "Visitas e ocorrências de Visita usam programação quando disponível; o vencimento original é preservado." : "Visitas usam data programada; ocorrências sem OS identificada usam vencimento original."} O
        resultado não representa demanda completa nem saldo; execução e esforço restante não foram
        comprovados.
      </p>
      {aoUsarParcial && usarV4 && resumo && q.data.disponibilidades.length > 0 && Number.isSafeInteger(disponibilidade) &&
        <button type="button" onClick={() => aoUsarParcial({ semana, disponibilidade, demanda: resumo!.internosMinutos })}>
          Usar subtotais parciais como hipótese
        </button>}
      {usarV2 && (
        <p>
          {q.data.pendentesSemSemana} OS abertas sem semana comprovada (contagem do Cliente, não
          desta semana).
        </p>
      )}
      {usarV3 && (
        <p>
          {
            q.data.fontesVisita.filter(
              (f) => f.prova_finalizacao_pcm === "finalizacao_pcm_registrada",
            ).length
          }{" "}
          finalização individual registrada pelo PCM; não comprova conclusão da ocorrência.
        </p>
      )}
      {usarV4 && (
        <div>
          {q.data.disponibilidades.length === 0 ? (
            <p>Não há disponibilidade declarada nesta consulta.</p>
          ) : Number.isSafeInteger(disponibilidade) ? (
            <p>Disponibilidade líquida declarada: {disponibilidade} minutos-homem.</p>
          ) : (
            <p role="alert">Disponibilidade indisponível por dados inconsistentes.</p>
          )}
          <p>
            Descontos declarados; sobreposição não verificada. Não representa disponibilidade
            efetiva nem saldo.
          </p>
          {q.data.disponibilidades.length > 0 && <details>
            <summary>Conferir disponibilidade declarada por técnico</summary>
            <p>Valores por técnico, referentes apenas a este Cliente e semana; não comprovam disponibilidade simultânea ou ausência de conflitos em outros Clientes.</p>
            <label>Filtrar técnico carregado <select value={tecnicoSelecionado} onChange={(e) => setFiltroTecnico({ contexto, id: e.target.value })}>
              <option value="">Todos os técnicos carregados</option>
              {tecnicoSelecionado && !q.data.disponibilidades.some((d) => chaveIdentidade(d.funcionario_id) === chaveIdentidade(tecnicoSelecionado)) && <option value={tecnicoSelecionado}>Técnico não disponível nesta consulta</option>}
              {q.data.disponibilidades.map((d) => <option key={d.id} value={d.funcionario_id}>{d.funcionario_id}</option>)}
            </select></label>
            <p>O filtro altera apenas a lista abaixo; o subtotal da semana não é filtrado. Técnicos fora das fontes carregadas não aparecem.</p>
            {disponibilidadesExibidas.length === 0 && <p>Nenhuma disponibilidade para o técnico selecionado nesta consulta.</p>}
            <ul>{disponibilidadesExibidas.map((d) => <li key={d.id}>
              Técnico {d.funcionario_id} · destinados {d.destinados_minutos} min · reservas {d.reservas_minutos} min · ausências {d.ausencias_minutos} min · diferença declarada {d.destinados_minutos-d.reservas_minutos-d.ausencias_minutos} min · revisão {d.revisao}.
            </li>)}</ul>
          </details>}
          {q.data.limiteDisponibilidadesAtingido && (
            <p>Limite de disponibilidades atingido; subtotal pode estar incompleto.</p>
          )}
        </div>
      )}
      {usarV5 && (
        <div>
          <p>
            Vínculos declarados da revisão atual: não comprovam cobertura, não alteram os totais e
            não incluem intervalos sem declaração.
          </p>
          {q.data.limiteVinculosIntervaloAtingido && (
            <p>Limite de vínculos atingido; lista parcial.</p>
          )}
          <ul>
            {q.data.vinculosIntervalo.map((v) => (
              <li key={v.intervalo_id}>
                Disponibilidade {v.disponibilidade_id} · Intervalo {v.intervalo_id} · {v.tipo} ·{" "}
                {v.incluido ? "inclusão declarada" : "inclusão retirada"} · revisão{" "}
                {v.revisao_vinculo}
              </li>
            ))}
          </ul>
        </div>
      )}
      {q.data.limiteFontesAtingido ||
      q.data.limiteOcorrenciasAtingido ||
      q.data.limiteOsSemVisitaAtingido ? (
        <p>Limite da consulta atingido: existem ou podem existir mais fontes não incluídas.</p>
      ) : null}
      {conflitos.length > 0 && <details>
        <summary>Conferir origens com possível duplicidade ({conflitos.length})</summary>
        <p>As fontes abaixo compartilham uma identidade de origem e não entram automaticamente no subtotal. Confira os vínculos antes de planejar; a lista cobre apenas os registros carregados.</p>
        <ul>{conflitos.map((conflito) => <li key={conflito.origem}>Origem {conflito.origem} · fontes {conflito.fontes.join(", ")}</li>)}</ul>
      </details>}
      <details>
        <summary>Conferir estimativas das fontes carregadas</summary>
        <p>Valores declarados não comprovam execução nem esforço restante. Ausência de valor não equivale a zero; a mesma origem pode aparecer em mais de uma fonte.</p>
        {q.data.fontesVisita.length === 0 && <p>Nenhuma OS vinculada a Visita nesta consulta.</p>}
        {q.data.fontesVisita.length > 0 && <section aria-label="OS programadas em Visitas">
          <h4>OS programadas em Visitas</h4>
          <ul>{q.data.fontesVisita.map((fonte, indice) => <li key={`${fonte.os_id}:${indice}`}>
            OS {fonte.os_id} · situação {fonte.os_status} · internos {fonte.internos_minutos === null ? "não informado" : `${fonte.internos_minutos} min`} · terceiros {fonte.terceiros_minutos === null ? "não informado" : `${fonte.terceiros_minutos} min`} · acompanhamento {fonte.acompanhamento_minutos === null ? "não informado" : `${fonte.acompanhamento_minutos} min`} · revisão {fonte.esforco_revision}.
          </li>)}</ul>
        </section>}
        {q.data.ocorrenciasSemOs.length === 0 && <p>Nenhuma ocorrência sem OS nesta consulta.</p>}
        {q.data.ocorrenciasSemOs.length > 0 && <section aria-label="Ocorrências sem OS identificada">
          <h4>Ocorrências sem OS identificada</h4>
          <ul>{q.data.ocorrenciasSemOs.map((fonte) => <li key={`${fonte.tipo}:${fonte.ocorrencia_id}`}>
            {fonte.tipo === "calendario" ? "Calendário" : "Visita"} · ocorrência {fonte.ocorrencia_id}{usarReferencia && <> · vencimento {fonte.vencimento_original} · referência {fonte.data_referencia}</>} · internos {fonte.internos_minutos === null ? "não informado" : `${fonte.internos_minutos} min`} · terceiros {fonte.terceiros_minutos === null ? "não informado" : `${fonte.terceiros_minutos} min`} · acompanhamento {fonte.acompanhamento_minutos === null ? "não informado" : `${fonte.acompanhamento_minutos} min`} · revisão {fonte.esforco_revision}.
          </li>)}</ul>
        </section>}
        {usarV2 && q.data.osSemVisita.length > 0 && <section aria-label="OS sem Visita">
          <h4>OS sem Visita na semana</h4>
          <ul>{q.data.osSemVisita.map((fonte) => <li key={fonte.os_id}>
            OS {fonte.os_id} · situação {fonte.os_status} · data de referência {fonte.data_referencia} · internos {fonte.internos_minutos === null ? "não informado" : `${fonte.internos_minutos} min`} · terceiros {fonte.terceiros_minutos === null ? "não informado" : `${fonte.terceiros_minutos} min`} · acompanhamento {fonte.acompanhamento_minutos === null ? "não informado" : `${fonte.acompanhamento_minutos} min`} · revisão {fonte.esforco_revision}.
          </li>)}</ul>
        </section>}
      </details>
      {!resumo ? (
        <p role="alert">Subtotal indisponível por dados inconsistentes.</p>
      ) : (
        <>
          <p>
            Interno declarado: {resumo.internosMinutos} minutos-homem, incluindo acompanhamento.
          </p>
          <p>Terceiros declarados: {resumo.terceirosMinutos} minutos-homem.</p>
          <p>Detalhe parcial da equipe própria: execução {resumo.execucaoPropriaMinutos} min e acompanhamento de terceiros {resumo.acompanhamentoMinutos} min. São parcelas do interno declarado, não somas adicionais.</p>
          {resumo.estimativasIncompletas > 0 && <p role="status">{resumo.estimativasIncompletas} fonte(s) somáveis têm estimativa ausente ou totalmente zerada; a demanda permanece incompleta.</p>}
          <p>
            Origens pendentes: {resumo.origensPendentes}; conflitantes e excluídas:{" "}
            {resumo.origensConflitantes}.
          </p>
          {usarV4 && q.data.disponibilidades.length > 0 && resumo.internosMinutos > 0 && Number.isSafeInteger(disponibilidade) && Number.isSafeInteger(disponibilidade - resumo.internosMinutos) && (
            <p>Diferença aritmética declarada: {disponibilidade - resumo.internosMinutos} minutos-homem. Não representa saldo operacional: execução, cobertura, sobreposições e dados pendentes não foram comprovados.</p>
          )}
        </>
      )}
    </section>
  );
}
