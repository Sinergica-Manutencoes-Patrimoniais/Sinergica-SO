import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const resposta = z.discriminatedUnion("situacao", [
  z.object({ requestId: z.string().guid(), itemId: z.string().guid(), situacao: z.literal("nao_encontrado_nao_conclusivo"), cobrancaEnviada: z.literal(false) }).strict(),
  z.object({ requestId: z.string().guid(), itemId: z.string().guid(), situacao: z.literal("inconsistente_investigar"), cobrancaEnviada: z.literal(false) }).strict(),
  z.object({ requestId: z.string().guid(), itemId: z.string().guid(), situacao: z.literal("alocacao_registrada"), alocacaoId: z.string().guid(), documentoId: z.string().guid(), revisaoItem: z.number().int(), cobrancaEnviada: z.literal(false) }).strict(),
]);
const armazenado = z.object({ requestId: z.string().guid(), alocacaoId: z.string().guid(), cliente: z.string().guid(), itemId: z.string().guid(), revisao: z.number().int().positive(), documentoId: z.string().guid(), valorCentavos: z.number().int().positive().safe() }).strict();
export function RecuperarParcela({ usuario, cliente, itemId }: { usuario: string; cliente: string; itemId: string }) {
  const [requestId, setRequestId] = useState(""); const [mensagem, setMensagem] = useState(""); const [ocupado, setOcupado] = useState(false);
  const contexto = useRef({ usuario, cliente, itemId, requestId });
  contexto.current = { usuario, cliente, itemId, requestId };
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const [localizados, setLocalizados] = useState<Array<{ requestId: string; documentoId: string }>>([]);
  const pedidosServidor = useInfiniteQuery({ queryKey: ["faturavel-pedidos-proprios", usuario, cliente, itemId], gcTime: 0, retry: false,
    initialPageParam: null as { data: string; id: string } | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("financeiro").rpc("sso_listar_pedidos_alocacao_proprios", { p_cliente_id: cliente, p_item_id: itemId, p_antes: pageParam?.data ?? null, p_antes_id: pageParam?.id ?? null, p_limite: 50 }).abortSignal(signal);
      if (error) throw error;
      const pagina=z.array(z.object({ request_id: z.string().guid(), criado_em: z.string().datetime({offset:true}), situacao: z.enum(["alocacao_registrada", "inconsistente_investigar"]), alocacao_id: z.string().guid().nullable(), documento_id: z.string().guid().nullable() }).strict()).max(50).parse(data);
      const vistos=new Set<string>();let anterior=pageParam;
      for(const p of pagina){const id=p.request_id.toLowerCase();const tempo=Date.parse(p.criado_em);
        if(vistos.has(id)||(p.situacao==="alocacao_registrada"&&(!p.alocacao_id||!p.documento_id))||(p.situacao==="inconsistente_investigar"&&(p.alocacao_id!==null||p.documento_id!==null)))throw new Error("Página inconsistente.");
        if(anterior&&(tempo>Date.parse(anterior.data)||(p.criado_em===anterior.data&&id>=anterior.id.toLowerCase())))throw new Error("Ordem inválida.");
        vistos.add(id);anterior={data:p.criado_em,id:p.request_id};}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 50 && pagina.at(-1) ? { data: pagina[pagina.length - 1]!.criado_em, id: pagina[pagina.length - 1]!.request_id } : undefined });
  const descobrir = () => { try { const achados: Array<{ requestId: string; documentoId: string }> = []; let invalidos = false;
    for (let n = 0; n < sessionStorage.length; n++) { const key = sessionStorage.key(n); if (!key?.startsWith("parcela-adicional:")) continue;
      let partes: unknown; try { partes = JSON.parse(key.slice("parcela-adicional:".length)); } catch { continue; }
      if (!Array.isArray(partes) || partes.length !== 4 || partes[0] !== usuario || partes[1] !== cliente || partes[2] !== itemId) continue;
      const raw = sessionStorage.getItem(key); if (!raw) continue;
      try { const p = armazenado.parse(JSON.parse(raw)); if (p.cliente !== cliente || p.itemId !== itemId || p.documentoId !== partes[3]) { invalidos = true; continue; } achados.push({ requestId: p.requestId, documentoId: p.documentoId }); } catch { invalidos = true; }
    }
    setLocalizados(achados); setMensagem(invalidos ? "Há pedido local ilegível; procure suporte. Nada foi apagado." : achados.length ? "Pedidos locais encontrados. Selecione um para consultar." : "Nenhum pedido local encontrado nesta sessão; isso não prova ausência no servidor.");
  } catch { setMensagem("Não foi possível ler pedidos desta sessão. Nada foi apagado."); } };
  const consultar = async () => { if (ocupado || !z.string().guid().safeParse(requestId).success) { setMensagem("Informe um identificador de pedido válido."); return; } const solicitado={usuario,cliente,itemId,requestId};setOcupado(true); setMensagem(""); try {
    const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario)throw new Error("Sessão alterada.");
    const { data, error } = await supabase.schema("financeiro").rpc("sso_recuperar_parcela_adicional", { p_cliente_id: cliente, p_item_id: itemId, p_request_id: requestId }); if (error) throw error; const r = resposta.parse(data); if (r.requestId !== requestId || r.itemId !== itemId) throw new Error("Resposta divergente");
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||!montado.current||JSON.stringify(contexto.current)!==JSON.stringify(solicitado))throw new Error("Contexto alterado.");
    setMensagem(r.situacao === "alocacao_registrada" ? `Alocação ${r.alocacaoId} registrada no documento ${r.documentoId}, revisão ${r.revisaoItem}.` : r.situacao === "inconsistente_investigar" ? "Comando encontrado sem alocação correspondente. Procure suporte." : "Pedido não encontrado; isso não prova que uma operação em trânsito falhou.");
  } catch { if(montado.current&&JSON.stringify(contexto.current)===JSON.stringify(solicitado))setMensagem("Não foi possível consultar o pedido ou o acesso."); } finally { if(montado.current)setOcupado(false); } };
  return <section aria-label="Recuperar parcela"><h5>Consultar pedido de parcela</h5><p>Consulta somente pelo autor e capacidade atual; não repete, cancela ou apaga a operação.</p><button type="button" onClick={descobrir}>Localizar pedidos desta sessão</button>
    <p>Pedidos registrados no servidor pelo usuário atual; pedidos em trânsito ou sem commit podem não aparecer.</p>
    {pedidosServidor.isFetching && <output>Consultando pedidos registrados…</output>}{pedidosServidor.isError && <p role="alert">Não foi possível consultar pedidos registrados. <button type="button" onClick={() => void pedidosServidor.refetch()}>Reconsultar</button></p>}
    {!pedidosServidor.isFetching && !pedidosServidor.isError && <ul>{pedidosServidor.data?.pages.flat().map((p) => <li key={p.request_id}>{p.criado_em} · {p.situacao} · pedido {p.request_id} <button type="button" onClick={() => {setRequestId(p.request_id);setMensagem("");}}>Selecionar</button></li>)}</ul>}
    {pedidosServidor.hasNextPage && <button type="button" disabled={pedidosServidor.isFetching} onClick={() => void pedidosServidor.fetchNextPage()}>Mais pedidos</button>}
    {localizados.length > 0 && <ul>{localizados.map((p) => <li key={p.requestId}>Documento {p.documentoId} · pedido {p.requestId} <button type="button" onClick={() => setRequestId(p.requestId)}>Selecionar</button></li>)}</ul>}
    <label>Identificador do pedido <input value={requestId} onChange={(e) => {setRequestId(e.target.value);setMensagem("");}} /></label>{" "}<button type="button" disabled={ocupado} onClick={() => void consultar()}>Consultar pedido</button>{mensagem && <p role="status">{mensagem}</p>}</section>;
}
