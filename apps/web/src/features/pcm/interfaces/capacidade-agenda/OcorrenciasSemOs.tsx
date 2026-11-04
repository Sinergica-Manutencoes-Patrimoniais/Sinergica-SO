import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { consolidarEsforcoVisitas } from "../../domain/consolidar-esforco-visitas";
import { EsforcoDeclarado } from "./EsforcoDeclarado";

const minutos = z.number().int().nonnegative().nullable();
const linha = z.object({
  tipo: z.enum(["calendario", "visita"]),
  ocorrencia_id: z.string().min(1),
  vencimento_original: z.string(),
  data_referencia: z.string().optional(),
  plano_id: z.string(),
  rotina_id: z.string(),
  alvo_tipo: z.string(),
  alvo_id: z.string(),
  esforco_revision: z.number().int().nonnegative(),
  internos_minutos: minutos,
  terceiros_minutos: minutos,
  acompanhamento_minutos: minutos,
  completude: z.literal("desconhecida"),
});
type Cursor = { tipo: "calendario" | "visita"; id: string } | null;
export function OcorrenciasSemOs({
  userId,
  clienteId,
  semana,
}: { userId: string; clienteId: string; semana: string }) {
  const [editada, setEditada] = useState<string | null>(null);
  const referenciaProgramada = import.meta.env.VITE_SSO_OCORRENCIAS_SEM_OS_REFERENCIA_ENABLED === "true";
  const q = useInfiniteQuery({
    queryKey: ["capacidade-ocorrencias-sem-os", userId, clienteId, semana, referenciaProgramada],
    gcTime: 0,
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc(referenciaProgramada ? "sso_ocorrencias_sem_os_referencia" : "sso_ocorrencias_sem_os_autorizadas", {
          p_cliente_id: clienteId,
          p_semana_inicio: semana,
          p_apos_tipo: pageParam?.tipo ?? null,
          p_apos_id: pageParam?.id ?? null,
          p_limite: 50,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(50).parse(data);
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const inicio = new Date(`${semana}T00:00:00.000Z`);
      if (!Number.isFinite(inicio.getTime()) || inicio.toISOString().slice(0, 10) !== semana || inicio.getUTCDay() !== 1)
        throw new Error("Semana inválida.");
      let anterior: Cursor = pageParam;
      for (const item of pagina) {
        const id = item.ocorrencia_id.toLowerCase();
        const vencimento = new Date(`${item.vencimento_original}T00:00:00.000Z`);
        const referenciaTexto = referenciaProgramada ? item.data_referencia : item.vencimento_original;
        const referencia = new Date(`${referenciaTexto}T00:00:00.000Z`);
        if (!uuid.test(id) || !uuid.test(item.plano_id) || !uuid.test(item.rotina_id) || !uuid.test(item.alvo_id) ||
          !Number.isFinite(vencimento.getTime()) || vencimento.toISOString().slice(0, 10) !== item.vencimento_original ||
          !referenciaTexto || !Number.isFinite(referencia.getTime()) || referencia.toISOString().slice(0, 10) !== referenciaTexto ||
          referencia.getTime() < inicio.getTime() || referencia.getTime() >= inicio.getTime() + 7 * 86_400_000 ||
          (item.tipo === "calendario" && referenciaTexto !== item.vencimento_original) ||
          (anterior !== null && (item.tipo < anterior.tipo || (item.tipo === anterior.tipo && id <= anterior.id.toLowerCase()))))
          throw new Error("Paginação ou ocorrência inválida.");
        anterior = { tipo: item.tipo, id };
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => {
      const ultima = pagina.at(-1);
      return pagina.length === 50 && ultima
        ? { tipo: ultima.tipo, id: ultima.ocorrencia_id }
        : undefined;
    },
  });
  if (q.isPending || q.isFetching) return <output>Carregando ocorrências…</output>;
  if (q.isError)
    return (
      <p role="alert">
        Ocorrências indisponíveis.{" "}
        <button type="button" onClick={() => void q.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  const linhas = q.data.pages.flat();
  const divergentes = linhas.some((linha, i) => {
    if (i === 0) return false;
    const anterior = linhas[i - 1]!;
    return linha.tipo < anterior.tipo || (linha.tipo === anterior.tipo && linha.ocorrencia_id.toLowerCase() <= anterior.ocorrencia_id.toLowerCase());
  });
  if (divergentes) return <p role="alert">As páginas de ocorrências divergiram; nenhum subtotal será apresentado. <button type="button" onClick={() => void q.refetch()}>Consultar novamente</button></p>;
  let resumo: ReturnType<typeof consolidarEsforcoVisitas> | null = null;
  try {
    resumo = consolidarEsforcoVisitas(
      linhas.map((f) => ({
        osId: `${f.tipo}:${f.ocorrencia_id}`,
        revision: f.esforco_revision,
        internosMinutos: f.internos_minutos,
        terceirosMinutos: f.terceiros_minutos,
        acompanhamentoMinutos: f.acompanhamento_minutos,
      })),
    );
  } catch {
    resumo = null;
  }
  return (
    <section aria-label="Ocorrências sem OS identificada">
      <h3>Ocorrências sem OS identificada</h3>
      <p>
        {referenciaProgramada ? "Semana pela programação da Visita ou vencimento quando indisponível; calendário usa vencimento original." : "Semana por vencimento original, não por programação."} Estado de execução desconhecido; não somar ao subtotal das OS: consultas podem ter snapshots diferentes.
      </p>
      {linhas.length === 0 ? (
        <p>Nenhuma candidata carregada; isso não prova demanda zero.</p>
      ) : resumo ? (
        <div>
          <p>
            Interno declarado: {resumo.internosMinutos} minutos-homem, incluindo acompanhamento.
          </p>
          <p>Terceiros declarados: {resumo.terceirosMinutos} minutos-homem.</p>
          <p>
            Da equipe própria: {resumo.execucaoPropriaMinutos} minutos de execução e{" "}
            {resumo.acompanhamentoMinutos} minutos de acompanhamento; já incluídos no interno.
          </p>
          {resumo.estimativasIncompletas > 0 && (
            <p role="status">
              {resumo.estimativasIncompletas} fonte(s) com estimativa não informada; ausência não
              significa zero.
            </p>
          )}
          <p>
            Origens pendentes: {resumo.origensPendentes}; conflitantes: {resumo.origensConflitantes}
            . Não representa demanda completa ou saldo.
          </p>
        </div>
      ) : (
        <p role="alert">Subtotal indisponível por dados inconsistentes.</p>
      )}
      <ul>
        {linhas.map((f) => (
          <li key={`${f.tipo}:${f.ocorrencia_id}`}>
            {f.tipo} {f.ocorrencia_id} · vencimento {f.vencimento_original}{referenciaProgramada && f.data_referencia && <> · referência na agenda {f.data_referencia}</>} · execução desconhecida
            {import.meta.env.VITE_SSO_ESFORCO_DECLARADO_ENABLED === "true" && (f.tipo === "calendario" || import.meta.env.VITE_SSO_ESFORCO_OCORRENCIA_VISITA_ENABLED === "true") && (
              <>
                <button type="button" onClick={() => setEditada(editada === `${f.tipo}:${f.ocorrencia_id}` ? null : `${f.tipo}:${f.ocorrencia_id}`)}>Declarar esforço da ocorrência</button>
                {editada === `${f.tipo}:${f.ocorrencia_id}` && <EsforcoDeclarado key={`${f.tipo}:${f.ocorrencia_id}`} userId={userId} clienteId={clienteId} osId={f.ocorrencia_id} origemTipo={f.tipo === "visita" ? "ocorrencia_visita" : "ocorrencia"} />}
              </>
            )}
          </li>
        ))}
      </ul>
      {q.hasNextPage && (
        <>
          <button
            type="button"
            disabled={q.isFetchingNextPage}
            onClick={() => void q.fetchNextPage()}
          >
            Mais ocorrências
          </button>
          <p>Lista parcial: há outras páginas.</p>
        </>
      )}
    </section>
  );
}
