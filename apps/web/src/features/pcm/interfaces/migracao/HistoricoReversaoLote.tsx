import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id = z.string().uuid();
const linha = z.object({ request_id: id, ator_id: id, motivo: z.string().min(1).max(2000),
  criado_em: z.string().datetime({ offset: true }), revertidos: z.number().int().nonnegative().max(20), pendentes: z.number().int().nonnegative().max(20),
  itens: z.array(z.object({ planoId: id, revisao: z.number().int().positive(), estado: z.enum(["revertido_logicamente", "pendente_reconciliacao"]) }).strict()).min(1).max(20) }).strict();

export function HistoricoReversaoLote(props: { userId: string; clienteId: string; loteId: string }) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.loteId])} {...props} />;
}
function Conteudo({ userId, clienteId, loteId }: { userId: string; clienteId: string; loteId: string }) {
  const [aberto, setAberto] = useState(false);
  const historico = useInfiniteQuery({ queryKey: ["migracao-historico-reversao-lote", userId, clienteId, loteId], enabled: aberto, gcTime: 0, retry: false,
    initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_reversoes_lote_legado", {
        p_ator_id: userId, p_cliente_id: clienteId, p_lote_id: loteId, p_apos: pageParam, p_limite: 20,
      }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(linha).max(20).parse(data); let anterior = pageParam?.toLowerCase() ?? "";
      for (const r of pagina) {
        if (r.request_id.toLowerCase() <= anterior || r.revertidos + r.pendentes !== r.itens.length ||
          r.revertidos !== r.itens.filter((i) => i.estado === "revertido_logicamente").length ||
          new Set(r.itens.map((i) => i.planoId.toLowerCase())).size !== r.itens.length) throw new Error("Histórico divergente.");
        anterior = r.request_id.toLowerCase();
      }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada."); return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.request_id : undefined });
  const itens = historico.data?.pages.flat() ?? [];
  const divergente = itens.some((r, indice) => indice > 0 && r.request_id.toLowerCase() <= itens[indice - 1]!.request_id.toLowerCase());
  return <section aria-label="Histórico das avaliações de reversão"><button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar histórico" : "Consultar histórico de avaliações"}</button>
    {aberto && <><p>Histórico ordenado por identificador, não por data; cada decisão preserva o histórico do Plano.</p>
      {historico.isFetching && <p>Consultando histórico…</p>}
      {(historico.isError || divergente) && <p role="alert">Histórico indisponível ou divergente. <button type="button" onClick={() => void historico.refetch()}>Atualizar</button></p>}
      {!historico.isFetching && !historico.isError && !divergente && historico.data && (itens.length ? <ol>{itens.map((r) => <li key={r.request_id}>
        {new Date(r.criado_em).toLocaleString("pt-BR")} · ator {r.ator_id} · {r.revertidos} encerrado(s) · {r.pendentes} pendente(s) · motivo: {r.motivo}
        <ul>{r.itens.map((i) => <li key={i.planoId}>Plano {i.planoId} · revisão {i.revisao} · {i.estado === "revertido_logicamente" ? "encerrado logicamente" : "pendente de reconciliação"}</li>)}</ul>
      </li>)}</ol> : <p>Nenhuma avaliação encontrada.</p>)}
      {historico.hasNextPage && !historico.isError && !divergente && <button type="button" disabled={historico.isFetching} onClick={() => void historico.fetchNextPage()}>Mais avaliações</button>}
    </>}
  </section>;
}
