import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { FilaPreventivaPcm } from "../interfaces/plano-manutencao/FilaPreventivaPcm";

const uuid = z.string().guid();
const linha = z.object({ ciclo_id: uuid, preparada_id: uuid, estado: z.enum(["aguardando", "verificacao", "cancelado"]),
  revisao: z.number().int().positive(), vencimento: z.string().date(), atualizado_em: z.string().datetime({ offset: true }),
  rotina_id: uuid, rotina_nome: z.string().nullable(), alvo_tipo: z.enum(["sistema", "componente", "grupo"]), alvo_id: uuid,
  versao_origem_id: uuid, visita_id: uuid, situacao_atual: z.enum(["conferida", "verificacao", "cancelada"]) }).strict();
type Cursor = { vencimento: string; ciclo: string } | null;
type Props = { userId: string; clienteId: string; planoId: string; estado: string; inicio: string; fim: string };

export function FilaVisitaWorkspace(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.planoId])} {...props} />;
}
function Conteudo({ userId, clienteId, planoId, estado, inicio, fim }: Props) {
  const [gestao, setGestao] = useState<{ ciclo: string; preparada: string } | null>(null);
  const invalido = !!inicio && !!fim && inicio > fim;
  const fila = useInfiniteQuery({
    queryKey: ["fila-preventiva-pcm", userId, clienteId, planoId, "visita-cronologica", estado, inicio, fim],
    initialPageParam: null as Cursor, enabled: !invalido, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_fila_visita_cronologica_v2", {
        p_cliente_id: clienteId, p_plano_id: planoId, p_estado: estado === "todos" ? null : estado,
        p_inicio: inicio || null, p_fim: fim || null, p_apos_vencimento: pageParam?.vencimento ?? null,
        p_apos_ciclo: pageParam?.ciclo ?? null, p_limite: 50,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(50).parse(data);
      let anterior = pageParam;
      for (const item of pagina) {
        if (anterior && (item.vencimento < anterior.vencimento || (item.vencimento === anterior.vencimento && item.ciclo_id.toLowerCase() <= anterior.ciclo.toLowerCase()))) throw new Error("Página divergente.");
        anterior = { vencimento: item.vencimento, ciclo: item.ciclo_id };
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina): Cursor | undefined => { const item = pagina.at(-1); return pagina.length === 50 && item ? { vencimento: item.vencimento, ciclo: item.ciclo_id } : undefined; },
  });
  const itens = fila.data?.pages.flat() ?? [];
  const consistente = itens.every((item, i) => i === 0 || itens[i - 1]!.vencimento < item.vencimento || (itens[i - 1]!.vencimento === item.vencimento && itens[i - 1]!.ciclo_id.toLowerCase() < item.ciclo_id.toLowerCase()));
  const visivel = !invalido && !!fila.data && !fila.isFetching && !fila.isError && consistente;
  return <section aria-label="Fila de ocorrências por Visita">
    <h3>Ocorrências por Visita</h3>
    <p>Registros da fila de Visita, apresentados separadamente dos ciclos de calendário. A situação é parcial e exige conferência atual da fonte e de eventual execução.</p>
    {!invalido && fila.isFetching && <p role="status">Consultando Visitas…</p>}
    {!invalido && (fila.isError || !consistente) && <p role="alert">Não foi possível conferir a fila de Visitas. <button type="button" onClick={() => void fila.refetch()}>Tentar novamente</button></p>}
    {visivel && <>
      {itens.length === 0 && <p>Nenhuma Visita nesta consulta.</p>}
      <ul>{itens.map((item) => <li key={item.ciclo_id}>
        Vencimento {item.vencimento.split("-").reverse().join("/")} · {item.estado === "aguardando" ? "registro aguardando" : item.estado === "verificacao" ? "conferir: execução desconhecida" : "registro cancelado"} · {item.rotina_nome ? `Rotina de referência: ${item.rotina_nome}` : "Rotina não identificada"} · alvo {item.alvo_tipo}: {item.alvo_id} · Visita {item.visita_id} · ciclo {item.ciclo_id} · revisão {item.revisao} · {item.situacao_atual === "conferida" ? "fonte conferida parcialmente" : item.situacao_atual === "verificacao" ? "fonte exige nova verificação" : "entrada cancelada"}
        <button type="button" aria-expanded={gestao?.ciclo === item.ciclo_id} onClick={() => setGestao(gestao?.ciclo === item.ciclo_id ? null : { ciclo: item.ciclo_id, preparada: item.preparada_id })}>
          {gestao?.ciclo === item.ciclo_id ? "Ocultar gestão" : "Gerenciar entrada"}
        </button>
      </li>)}</ul>
      {fila.hasNextPage && <button type="button" disabled={fila.isFetching} onClick={() => void fila.fetchNextPage()}>Carregar mais Visitas</button>}
      {fila.hasNextPage && <p>Existem mais páginas de Visitas.</p>}
    </>}
    {gestao && <div>{!itens.some((item) => item.ciclo_id === gestao.ciclo) && <p>A entrada aberta não está nos resultados carregados. <button type="button" onClick={() => setGestao(null)}>Fechar gestão</button></p>}
      <FilaPreventivaPcm userId={userId} clienteId={clienteId} planoId={planoId} preparadaId={gestao.preparada} tipo="visita" />
    </div>}
  </section>;
}
