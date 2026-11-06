import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ id: z.string().uuid(), tipo: z.enum(["dispensada", "revogada"]), dispensa_id: z.string().uuid(),
  lista_revisao: z.number().int().positive(), motivo: z.string(), ator_id: z.string().uuid(), criado_em: z.string() }).strict();
const pedidoSchema = z.object({ requestId: z.string().uuid(), revogacaoId: z.string().uuid(), dispensaId: z.string().uuid(),
  listaId: z.string().uuid(), listaRevision: z.number().int().positive(), motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { usuario: string; cliente: string; ordemServico: string; listaId: string; listaRevision: number; vigenteId: string | null };
export function HistoricoDispensa(props: Props) {
  if (import.meta.env.VITE_SSO_HISTORICO_DISPENSA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.ordemServico, props.listaId])} {...props} />;
}
function Conteudo({ usuario, cliente, ordemServico, listaId, listaRevision, vigenteId }: Props) {
  const chave = `sso-revogar-dispensa:${usuario}:${cliente}:${ordemServico}:${listaId}`; const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState(""); const [confirmado, setConfirmado] = useState(false); const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo)); return p.listaId === listaId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const historico = useInfiniteQuery({ queryKey: ["dispensa-historico", usuario, cliente, ordemServico, listaId], gcTime: 0, retry: false,
    staleTime: 0, refetchOnWindowFocus: true, initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.schema("comercial").rpc("sso_historico_dispensa", { p_lista_id: listaId, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(linha).parse(data);
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    const { data, error } = await supabase.schema("comercial").rpc("sso_revogar_dispensa", {
      p_request_id: p.requestId, p_revogacao_id: p.revogacaoId, p_dispensa_id: p.dispensaId,
      p_lista_revision: p.listaRevision, p_motivo: p.motivo });
    if (error) throw error;
    if (!data || data.aggregateId !== p.revogacaoId || data.revision !== p.listaRevision || data.state !== "revogada" ||
      data.requestId !== p.requestId || data.linkedIds?.listaId !== p.listaId || data.linkedIds?.dispensaId !== p.dispensaId) throw new Error("Resposta inválida.");
  }, onSuccess: async () => { try { sessionStorage.removeItem(chave); } catch { setMensagem("Revogação registrada; contate suporte para limpar tentativa local."); return; }
    setPendente(null); setMensagem("Dispensa revogada; histórico e faturamento foram preservados.");
    await queryClient.invalidateQueries({ queryKey: ["dispensa-historico", usuario, cliente, ordemServico, listaId] });
    await queryClient.invalidateQueries({ queryKey: ["dispensa-lista", usuario, cliente, ordemServico, listaId] }); },
  onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."), });
  function registrar(p: Pedido) { try { sessionStorage.setItem(chave, JSON.stringify(p)); } catch { setMensagem("Não foi possível guardar tentativa; revogação não enviada."); return; }
    setPendente(p); setMensagem(""); enviar.mutate(p); }
  return <section aria-label="Histórico de dispensa"><h5>Histórico da dispensa</h5>
    {historico.isFetching && <p>Consultando histórico…</p>}
    {historico.isError && <p role="alert">Histórico indisponível ou sem acesso. <button type="button" onClick={() => void historico.refetch()}>Tentar novamente</button></p>}
    {!historico.isFetching && !historico.isError && historico.data?.pages.flat().length === 0 && <p>Nenhuma decisão registrada.</p>}
    {!historico.isFetching && !historico.isError && historico.data?.pages.flat().map((h) => <p key={h.id}>
      {h.tipo} · revisão da lista {h.lista_revisao} · {h.motivo} · autor {h.ator_id} · {new Date(h.criado_em).toLocaleString("pt-BR")}</p>)}
    {!historico.isError && historico.hasNextPage && <button type="button" onClick={() => void historico.fetchNextPage()}>Mais eventos</button>}
    {vigenteId && <form onSubmit={(e) => { e.preventDefault(); if (pendente || enviar.isPending || !confirmado) return;
      try { registrar(pedidoSchema.parse({ requestId: crypto.randomUUID(), revogacaoId: crypto.randomUUID(), dispensaId: vigenteId, listaId, listaRevision, motivo })); }
      catch { setMensagem("Informe o motivo da revogação."); }
    }}><fieldset disabled={!!pendente || enviar.isPending}>
      <p>Revogar não altera faturamento nem propostas existentes.</p>
      <label>Motivo da revogação <textarea maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} /> Confirmo a revogação.</label>
      <button type="submit" disabled={!confirmado}>Revogar dispensa</button>
    </fieldset></form>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
