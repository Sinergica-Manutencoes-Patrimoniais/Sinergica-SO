import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { HistoricoDocumentoCobranca } from "./HistoricoDocumentoCobranca";

const item = z.object({ cobranca_id: z.string().guid(), anexo_id: z.string().guid(), titulo: z.string() }).strict();
const pedidoSchema = z.object({ requestId: z.string().guid(), cobrancaId: z.string().guid(), anexoId: z.string().guid() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
export function VincularDocumentoCobranca({ usuario, cliente, lancamento }: { usuario: string; cliente: string; lancamento: string }) {
  const [aberto, setAberto] = useState(false);
  const chave = `sso-documento-cobranca:${JSON.stringify([usuario, cliente, lancamento])}`; const cache = useQueryClient();
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); return s ? pedidoSchema.parse(JSON.parse(s)) : null; } catch { return "invalido"; } });
  const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const lista = useInfiniteQuery({ queryKey: ["anexos-publicados-cobranca", usuario, cliente, lancamento], enabled: aberto,
    gcTime: 0, staleTime: 0, retry: false, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("financeiro").rpc("sso_anexos_publicados_para_cobranca", {
      p_cliente_id: cliente, p_lancamento_id: lancamento, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(item).max(20).parse(data); }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.anexo_id : undefined });
  const comando = useMutation({ mutationFn: async (p: Pedido) => {
    const { data, error } = await supabase.schema("financeiro").rpc("sso_publicar_documento_cobranca_v2", { p_request_id: p.requestId, p_cobranca_id: p.cobrancaId, p_anexo_id: p.anexoId });
    if (error) throw error; return z.string().guid().parse(data);
  }, onSuccess: async (_id, p) => { try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setAviso("Pedido registrado; confira o histórico. Repetição não restaura vínculo retirado.");
    await cache.invalidateQueries({ queryKey: ["historico-documentos-cobranca", usuario, cliente, lancamento] });
  }, onError: () => setAviso("Resultado não confirmado; repita o pedido ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (enviando.current) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar(a: z.infer<typeof item>) { if (pendente || enviando.current) return; try {
    const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), cobrancaId: a.cobranca_id, anexoId: a.anexo_id });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Não foi possível guardar pedido. Nada foi enviado."); } }
  if (import.meta.env.VITE_SSO_DOCUMENTO_COBRANCA_ENABLED !== "true") return null;
  return <section><button type="button" onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar documentos" : "Vincular documento público à cobrança"}</button>
    {aberto && <><p>Selecione apenas arquivo já revisado e publicado na mesma OS. Não use comprovantes internos.</p>
      {lista.isFetching && <p>Consultando arquivos…</p>}{lista.isError && <p role="alert">Arquivos indisponíveis. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
      {!lista.isFetching && !lista.isError && lista.data?.pages.flat().length === 0 && <p>Nenhuma cobrança atual com anexo público disponível.</p>}
      {!lista.isFetching && !lista.isError && lista.data?.pages.flat().map((a) => <p key={a.anexo_id}>{a.titulo} <button type="button" disabled={!!pendente || comando.isPending} onClick={() => iniciar(a)}>Vincular à cobrança</button></p>)}
      {!lista.isError && lista.hasNextPage && <button type="button" onClick={() => void lista.fetchNextPage()}>Mais arquivos</button>}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
      {pendente && pendente !== "invalido" && <button type="button" disabled={comando.isPending} onClick={() => enviar(pendente)}>Repetir pedido</button>}
      {aviso && <p role="status">{aviso}</p>}
      <HistoricoDocumentoCobranca usuario={usuario} cliente={cliente} lancamento={lancamento} /></>}
  </section>;
}
