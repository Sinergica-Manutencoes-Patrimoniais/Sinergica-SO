import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const base = { requestId: z.string().guid(), itemId: z.string().guid(), expectedRevision: z.number().int().positive(), motivo: z.string().trim().min(1).max(2000), protocolo: z.literal("mediado").optional() };
const schema = z.discriminatedUnion("tipo", [
  z.object({ ...base, tipo: z.literal("estornar"), estornoId: z.string().guid(), alocacaoId: z.string().guid() }).strict(),
  z.object({ ...base, tipo: z.literal("complementar"), novoItemId: z.string().guid(), complementoId: z.string().guid(), valorCentavos: z.number().int().positive().safe() }).strict(),
]);
type Pedido = z.infer<typeof schema>;
function mesmaTentativa(salvo: string | null, pedido: Pedido): boolean {
  if (salvo === null) return false;
  try { return JSON.stringify(schema.parse(JSON.parse(salvo))) === JSON.stringify(schema.parse(pedido)); }
  catch { return false; }
}
type Props = { usuario: string; cliente: string; itemId: string; revisao: number; status: string };
export function CorrigirFaturavel(props: Props) {
  if (import.meta.env.VITE_SSO_CORRIGIR_FATURAVEL_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.itemId])} {...props} />;
}
function Conteudo({ usuario, cliente, itemId, revisao, status }: Props) {
  const chave = `sso-correcao-faturavel:${usuario}:${cliente}:${itemId}`;
  const emEnvio = useRef(false);
  const queryClient = useQueryClient();
  const [valor, setValor] = useState(""); const [motivo, setMotivo] = useState("");
  const [acao, setAcao] = useState<{ tipo: "estornar"; alocacaoId: string; documento: string; valorCentavos: number; criadoEm: string } | { tipo: "complementar" } | null>(null);
  const [confirmado, setConfirmado] = useState<string | null>(null); const [mensagem, setMensagem] = useState("");
  const confirmacao = JSON.stringify({ usuario, cliente, itemId, revisao, status, valor, motivo, acao });
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = schema.parse(JSON.parse(salvo)); return p.itemId === itemId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const alocacoes = useInfiniteQuery({ queryKey: ["faturavel-alocacoes", usuario, cliente, itemId], gcTime: 0, retry: false,
    enabled: status === "parcial" || status === "faturado", initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const antes=await supabase.auth.getUser(); if(antes.error||antes.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");
      const { data, error } = await (import.meta.env.VITE_SSO_CORRIGIR_FATURAVEL_MEDIADO_ENABLED === "true" ? supabase.schema("financeiro").rpc("sso_listar_alocacoes_mediada", { p_ator_id: usuario, p_cliente_id: cliente, p_item_id: itemId, p_apos: pageParam }) : supabase.schema("financeiro").rpc("sso_listar_alocacoes_faturavel", { p_item_id: itemId, p_apos: pageParam })).abortSignal(signal);
      if (error) throw error; const pagina=z.array(z.object({ id: z.string().guid(), documento_ref: z.string(),
        valor_centavos: z.number().int().positive().safe(), estornada: z.boolean(), criado_em: z.string() }).strict()).max(20).parse(data);
      let anterior=pageParam?.toLowerCase()??"";for(const item of pagina){if(item.id.toLowerCase()<=anterior)throw new Error("Página divergente.");anterior=item.id.toLowerCase();}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");return pagina; },
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    const antes=await supabase.auth.getUser();
    if(antes.error||antes.data.user?.id!==usuario||!mesmaTentativa(sessionStorage.getItem(chave),p))throw new Error("Sessão ou tentativa alterada.");
    const chamada = p.tipo === "estornar" ? await supabase.schema("financeiro").rpc(p.protocolo === "mediado" ? "sso_estornar_alocacao_mediada" : "sso_estornar_alocacao", {
      ...(p.protocolo === "mediado" ? { p_ator_id: usuario, p_cliente_id: cliente } : {}),
      p_request_id: p.requestId, p_estorno_id: p.estornoId, p_item_id: p.itemId, p_expected_revision: p.expectedRevision,
      p_alocacao_id: p.alocacaoId, p_motivo: p.motivo }) : await supabase.schema("financeiro").rpc(p.protocolo === "mediado" ? "sso_complementar_faturavel_mediado" : "sso_complementar_faturavel", {
      ...(p.protocolo === "mediado" ? { p_ator_id: usuario, p_cliente_id: cliente } : {}),
      p_request_id: p.requestId, p_item_base_id: p.itemId, p_expected_revision: p.expectedRevision,
      p_item_id: p.novoItemId, p_complemento_id: p.complementoId, p_valor_centavos: p.valorCentavos, p_motivo: p.motivo });
    if (chamada.error) throw chamada.error;
    const r = chamada.data;
    if (!r || r.aggregateId !== p.itemId || r.requestId !== p.requestId || r.revision !== p.expectedRevision + 1 ||
      (p.tipo === "estornar" ? r.linkedIds?.estornoId !== p.estornoId : r.linkedIds?.complementoId !== p.novoItemId)) throw new Error("Resposta inválida.");
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario)throw new Error("Sessão alterada.");
  }, onSuccess: async (_resultado, pedido) => { try {
    const atual=await supabase.auth.getUser();
    const salvo = sessionStorage.getItem(chave);
    if (atual.error || atual.data.user?.id!==usuario || !mesmaTentativa(salvo, pedido)) {
      setMensagem("Operação registrada; sessão ou tentativa local divergente. Contate suporte."); return;
    }
    sessionStorage.removeItem(chave);
  } catch { setMensagem("Operação registrada; contate suporte para limpar tentativa local."); return; }
    setPendente(null); setConfirmado(null); setAcao(null); setMensagem("Operação registrada. O lançamento financeiro não foi alterado.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["faturaveis", usuario, cliente] }),
      queryClient.invalidateQueries({ queryKey: ["faturavel-alocacoes", usuario, cliente, itemId] }),
      queryClient.invalidateQueries({ queryKey: ["faturavel-saldo", usuario, cliente, itemId] }),
      queryClient.invalidateQueries({ queryKey: ["faturavel-previa-parcela-documento", usuario, cliente, itemId] }),
      queryClient.invalidateQueries({ queryKey: ["documento-interno-contexto", usuario, cliente, itemId] }),
      queryClient.invalidateQueries({ queryKey: ["documento-interno-historico", usuario, cliente, itemId] }),
      queryClient.invalidateQueries({ queryKey: ["relatorio-alocacao-pagamento", usuario, cliente] }),
    ]); },
  onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."),
  onSettled: () => { emEnvio.current = false; }, });
  function registrar(p: Pedido) { if (emEnvio.current) return;
    try { const salvo = sessionStorage.getItem(chave);
      if ((salvo !== null && !mesmaTentativa(salvo, p)) || (salvo === null && pendente !== null)) {
        setMensagem("Há outra tentativa local pendente. Contate suporte."); return;
      }
      if (salvo === null) sessionStorage.setItem(chave, JSON.stringify(p));
    } catch { setMensagem("Não foi possível guardar tentativa; operação não enviada."); return; }
    emEnvio.current = true;
    setPendente(p); setMensagem(""); enviar.mutate(p); }
  function iniciar(tipo: "estornar" | "complementar", alocacaoId?: string) {
    if (pendente || enviar.isPending || emEnvio.current || confirmado!==confirmacao || !acao || acao.tipo!==tipo || (acao.tipo==="estornar" && acao.alocacaoId!==alocacaoId)) return;
    const linhas=alocacoes.data?.pages.flat()??[];
    const divergentes=linhas.some((item,i)=>i>0&&item.id.toLowerCase()<=linhas[i-1]!.id.toLowerCase());
    if (tipo === "estornar" && (alocacoes.isFetching || alocacoes.isError || divergentes || acao.tipo !== "estornar" || !linhas.some((item) => item.id === alocacaoId && !item.estornada && item.documento_ref === acao.documento && item.valor_centavos === acao.valorCentavos && item.criado_em === acao.criadoEm))) {
      setMensagem("A alocação não está disponível ou mudou. Atualize a consulta antes de continuar."); return;
    }
    try { const comum = { requestId: crypto.randomUUID(), itemId, expectedRevision: revisao, motivo, ...(import.meta.env.VITE_SSO_CORRIGIR_FATURAVEL_MEDIADO_ENABLED === "true" ? { protocolo: "mediado" as const } : {}) };
      registrar(schema.parse(tipo === "estornar" ? { ...comum, tipo, estornoId: crypto.randomUUID(), alocacaoId } :
        { ...comum, tipo, novoItemId: crypto.randomUUID(), complementoId: crypto.randomUUID(), valorCentavos: /^\d+$/.test(valor) ? Number(valor) : NaN }));
    } catch { setMensagem("Confira motivo e valor em centavos."); }
  }
  return <section><h4>Complemento ou estorno lógico</h4>
    <p>Estorno é integral por alocação e não altera o lançamento financeiro. Exige reconciliação no Financeiro.</p>
    <fieldset disabled={!!pendente || enviar.isPending}>
      <label>Motivo <textarea maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <label>Valor do complemento, em centavos <input inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
      <button type="button" onClick={() => {setAcao({tipo:"complementar"});setConfirmado(null);}}>Selecionar complemento</button>
      {alocacoes.isError && <p role="alert">Não foi possível consultar alocações.</p>}
      {!alocacoes.isFetching && !alocacoes.isError && alocacoes.data && alocacoes.data.pages.flat().some((item,i,lista)=>i>0&&item.id.toLowerCase()<=lista[i-1]!.id.toLowerCase()) && <p role="alert">Páginas de alocações divergentes. <button type="button" onClick={()=>void alocacoes.refetch()}>Reconsultar</button></p>}
      {!alocacoes.isFetching && !alocacoes.isError && alocacoes.data && !alocacoes.data.pages.flat().some((item,i,lista)=>i>0&&item.id.toLowerCase()<=lista[i-1]!.id.toLowerCase()) && alocacoes.data.pages.flat().map((a) => <p key={a.id}>{a.documento_ref} · {a.valor_centavos} centavos · {a.estornada ? "estornada" : "ativa"}
        {!a.estornada && <button type="button" onClick={() => {setAcao({tipo:"estornar",alocacaoId:a.id,documento:a.documento_ref,valorCentavos:a.valor_centavos,criadoEm:a.criado_em});setConfirmado(null);}}>Selecionar estorno</button>}</p>)}
      {alocacoes.hasNextPage && <button type="button" onClick={() => void alocacoes.fetchNextPage()}>Mais alocações</button>}
      {acao && <div><p>Item {itemId} · revisão {revisao} · {acao.tipo==="complementar" ? `complemento de ${valor || "valor não informado"} centavos` : `estorno da alocação ${acao.alocacaoId}, documento ${acao.documento}, valor ${acao.valorCentavos} centavos`} · motivo: {motivo || "não informado"}.</p>
        {confirmado && confirmado!==confirmacao && <p role="alert">Dados alterados; confira novamente.</p>}
        <label><input type="checkbox" checked={confirmado===confirmacao} onChange={(e)=>setConfirmado(e.target.checked?confirmacao:null)} /> Confirmei a operação e a necessidade de conciliação.</label>
        <button type="button" disabled={confirmado!==confirmacao} onClick={()=>iniciar(acao.tipo,acao.tipo==="estornar"?acao.alocacaoId:undefined)}>{acao.tipo==="estornar"?"Confirmar estorno":"Criar complemento"}</button>
      </div>}
    </fieldset>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
