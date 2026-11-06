import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

type Props = { userId: string; clienteId: string; visitaId: string; osId: string; revisao: number; bloqueado: boolean };
const item = z.object({ id: z.string().uuid(), revisao: z.number().int().positive(), mensagem: z.string(), publicado_em: z.string(), revogado_em: z.string().nullable() }).strict();
const pedidoSchema = z.object({ requestId: z.string().uuid(), visitaId: z.string().uuid(), osId: z.string().uuid(), revisao: z.number().int().positive(), mensagem: z.string().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
export function PublicarVisitaPortal({ userId, clienteId, visitaId, osId, revisao, bloqueado }: Props) {
  const [mensagem, setMensagem] = useState("");
  const chavePedido = `sso-publicar-visita:${JSON.stringify([userId, clienteId, visitaId, osId, revisao])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try {
    const texto = sessionStorage.getItem(chavePedido); if (!texto) return null;
    const p = pedidoSchema.parse(JSON.parse(texto)); return p.visitaId === visitaId && p.osId === osId && p.revisao === revisao ? p : "invalido";
  } catch { return "invalido"; } });
  const enviando = useRef(false); const [aviso, setAviso] = useState("");
  const [historico, setHistorico] = useState(false); const cache = useQueryClient();
  const chave = ["pcm-publicacoes-visita", userId, clienteId, visitaId, osId];
  const consulta = useInfiniteQuery({ queryKey: chave, enabled: historico && !bloqueado, gcTime: 0, staleTime: 0, retry: false,
    initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_publicacoes_visita", { p_cliente_id: clienteId,
        p_visita_id: visitaId, p_os_id: osId, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(item).max(20).parse(data);
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const publicacao = useMutation({ mutationFn: async (p: Pedido) => {
    const { data, error } = await supabase.schema("pcm").rpc("sso_portal_publicar_visita_v2", {
      p_request_id: p.requestId, p_visita_id: p.visitaId, p_os_id: p.osId, p_revisao: p.revisao, p_mensagem: p.mensagem,
    });
    if (error) throw error; return z.string().uuid().parse(data);
  }, onSuccess: async (_id, p) => {
    try { if (sessionStorage.getItem(chavePedido) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chavePedido); }
    catch { setAviso("Pedido processado, mas a tentativa local não foi limpa. Consulte o histórico."); return; }
    setPendente(null); setMensagem(""); setAviso("Pedido registrado. Confira o histórico; repetição não restaura comunicação retirada.");
    await cache.invalidateQueries({ queryKey: chave });
  }, onError: () => setAviso("Resultado não confirmado. Repita o pedido ou consulte o histórico."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (bloqueado || enviando.current) return; enviando.current = true; setAviso(""); publicacao.mutate(p); }
  function iniciar() { if (bloqueado || pendente || enviando.current) return; try {
    const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), visitaId, osId, revisao, mensagem: mensagem.trim() });
    if (sessionStorage.getItem(chavePedido) !== null) throw new Error("Pedido existente");
    sessionStorage.setItem(chavePedido, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Confira os dados e a sessão. Nada foi enviado."); } }
  return <section>
    {pendente === "invalido" && <p role="alert">Pedido local ilegível. Consulte suporte e histórico.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={bloqueado || publicacao.isPending} onClick={() => enviar(pendente)}>Repetir pedido</button> :
    !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
    <label>Mensagem pública para o Cliente
      <textarea value={mensagem} maxLength={1000} required disabled={bloqueado || publicacao.isPending}
        onChange={(e) => setMensagem(e.target.value)} />
    </label>
    <p>Confira o conteúdo antes de publicar. A ciência no Portal é informativa e não confirma a visita.</p>
    <button type="submit" disabled={bloqueado || publicacao.isPending || !mensagem.trim()}>Publicar comunicação</button>
  </form>}
    {aviso && <p role="status">{aviso}</p>}
    <button type="button" disabled={bloqueado} onClick={() => setHistorico((v) => !v)}>{historico ? "Ocultar comunicações" : "Ver comunicações"}</button>
    {historico && !bloqueado && consulta.isFetching && <p>Consultando comunicações…</p>}
    {historico && !bloqueado && consulta.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {historico && !bloqueado && !consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().length === 0 && <p>Nenhuma comunicação registrada.</p>}
    {historico && !bloqueado && !consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().map((p) => <article key={p.id}>
      <p>Revisão {p.revisao} · {p.revisao === revisao ? "atual" : "anterior"} · {p.revogado_em ? "retirada" : "não retirada"}</p>
      <p>{p.mensagem} · {new Date(p.publicado_em).toLocaleString("pt-BR")}</p>
      {!p.revogado_em && <Retirar id={p.id} chave={chave} bloqueado={bloqueado} />}
    </article>)}
    {historico && !bloqueado && !consulta.isError && consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais comunicações</button>}
  </section>;
}
function Retirar({ id, chave, bloqueado }: { id: string; chave: string[]; bloqueado: boolean }) {
  const [motivo, setMotivo] = useState(""); const cache = useQueryClient();
  const acao = useMutation({ mutationFn: async () => {
    const { error } = await supabase.schema("pcm").rpc("sso_retirar_publicacao_visita", { p_publicacao_id: id, p_motivo: motivo.trim() });
    if (error) throw error;
  }, onSuccess: () => cache.invalidateQueries({ queryKey: chave }) });
  return <form onSubmit={(e) => { e.preventDefault(); if (!bloqueado && motivo.trim()) acao.mutate(); }}>
    <label>Motivo da retirada <input required maxLength={1000} value={motivo} disabled={bloqueado || acao.isPending} onChange={(e) => setMotivo(e.target.value)} /></label>
    <button type="submit" disabled={bloqueado || acao.isPending || !motivo.trim()}>Retirar comunicação</button>
    {acao.isError && <p role="alert">Não foi possível retirar a comunicação. Confira acesso e tente novamente.</p>}
  </form>;
}
