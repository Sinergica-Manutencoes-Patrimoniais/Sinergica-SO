import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const esquema = z.object({ requestId: z.string().uuid(), conferenciaId: z.string().uuid(), estornoId: z.string().uuid(),
  saidaId: z.string().uuid(), referencia: z.string().trim().min(1).max(200), motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof esquema>;
export function ConferirEstornos(props: { usuario: string; cliente: string }) {
  if (import.meta.env.VITE_SSO_CONFERIR_ESTORNO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente])} {...props} />;
}
function Conteudo({ usuario, cliente }: { usuario: string; cliente: string }) {
  const chave = `sso-conferir-estorno:${usuario}:${cliente}`;
  const emEnvio = useRef(false);
  const queryClient = useQueryClient();
  const [estorno, setEstorno] = useState(""); const [saida, setSaida] = useState("");
  const [referencia, setReferencia] = useState(""); const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null); const [mensagem, setMensagem] = useState("");
  const confirmacao = JSON.stringify({ usuario, cliente, estorno, saida, referencia, motivo });
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); return salvo ? esquema.parse(JSON.parse(salvo)) : null; }
    catch { return "invalido"; }
  });
  const estornos = useInfiniteQuery({ queryKey: ["estornos-conferencia", usuario, cliente], gcTime: 0, retry: false,
    initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("financeiro").rpc("sso_estornos_para_conferencia", { p_cliente_id: cliente, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; const pagina=z.array(z.object({ id: z.string().uuid(), item_id: z.string().uuid(),
        valor_centavos: z.number().int().positive().safe(), criado_em: z.string() }).strict()).max(20).parse(data);
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const saidas = useInfiniteQuery({ queryKey: ["saidas-conferencia", usuario, cliente, estorno], gcTime: 0, retry: false,
    enabled: !!estorno, initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("financeiro").rpc("sso_saidas_para_conferencia", { p_estorno_id: estorno, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; const pagina=z.array(z.object({ id: z.string().uuid(), descricao: z.string().nullable(),
        valor_centavos: z.number().int().positive().safe(), competencia: z.string(), pagamento: z.string().nullable() }).strict()).max(20).parse(data);
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou pedido alterado.");
    const { data, error } = await supabase.schema("financeiro").rpc("sso_conferir_estorno_faturavel", {
      p_request_id: p.requestId, p_conferencia_id: p.conferenciaId, p_estorno_id: p.estornoId, p_saida_id: p.saidaId,
      p_referencia: p.referencia, p_motivo: p.motivo });
    if (error) throw error;
    if (!data || data.requestId !== p.requestId || data.state !== "conferencia_declarada" ||
      data.linkedIds?.conferenciaId !== p.conferenciaId || data.linkedIds?.estornoId !== p.estornoId || data.linkedIds?.saidaId !== p.saidaId)
      throw new Error("Resposta inválida.");
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario)throw new Error("Sessão alterada.");
  }, onSuccess: async (_resultado, pedido) => { let limpa = false;
    try { const atual=await supabase.auth.getUser();if (!atual.error&&atual.data.user?.id===usuario&&sessionStorage.getItem(chave) === JSON.stringify(pedido)) { sessionStorage.removeItem(chave); limpa = true; } } catch { /* Não apagar outra tentativa. */ }
    if (limpa) {
      setPendente(null); setMensagem("Conferência registrada; confirme a conciliação financeira pelos procedimentos do Financeiro.");
      setEstorno(""); setSaida(""); setConfirmado(null);
    } else setMensagem("Conferência registrada; tentativa local divergente ou indisponível. Contate suporte.");
    await queryClient.invalidateQueries({ queryKey: ["estornos-conferencia", usuario, cliente] }); },
  onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."),
  onSettled: () => { emEnvio.current = false; }, });
  function registrar(p: Pedido) { if (emEnvio.current) return;
    try { const salvo = sessionStorage.getItem(chave);
      if ((salvo !== null && salvo !== JSON.stringify(p)) || (salvo === null && pendente !== null)) {
        setMensagem("Há outra tentativa local pendente. Contate suporte."); return;
      }
      sessionStorage.setItem(chave, JSON.stringify(p));
    } catch { setMensagem("Não foi possível guardar tentativa; conferência não enviada."); return; }
    emEnvio.current = true;
    setPendente(p); setMensagem(""); enviar.mutate(p); }
  return <section><h3>Conferência de contrapartida de estorno</h3>
    <p>Selecionar valores iguais não comprova a origem da devolução. Verifique documento e lançamento antes de registrar; esta ação não altera o Financeiro.</p>
    {(estornos.isError || saidas.isError) && <p role="alert">Não foi possível consultar os registros autorizados.</p>}
    <form onSubmit={(e) => { e.preventDefault(); if (pendente || enviar.isPending || confirmado!==confirmacao || estornos.isFetching || saidas.isFetching || estornos.isError || saidas.isError || !estornos.data?.pages.flat().some(x=>x.id===estorno) || !saidas.data?.pages.flat().some(x=>x.id===saida)) return;
      try { registrar(esquema.parse({ requestId: crypto.randomUUID(), conferenciaId: crypto.randomUUID(), estornoId: estorno,
        saidaId: saida, referencia, motivo })); } catch { setMensagem("Confira estorno, saída, referência e motivo."); }
    }}><fieldset disabled={!!pendente || enviar.isPending || estornos.isPending || estornos.isError || saidas.isError}>
      <label>Estorno lógico <select required value={estorno} onChange={(e) => { setEstorno(e.target.value); setSaida(""); }}>
        <option value="">Selecione</option>{estornos.data?.pages.flat().map((e) => <option key={e.id} value={e.id}>{e.id} · {e.valor_centavos} centavos</option>)}</select></label>
      {estornos.hasNextPage && <button type="button" onClick={() => void estornos.fetchNextPage()}>Mais estornos</button>}
      <label>Saída financeira realizada <select required value={saida} onChange={(e) => setSaida(e.target.value)} disabled={!estorno}>
        <option value="">Selecione</option>{saidas.data?.pages.flat().map((s) => <option key={s.id} value={s.id}>{s.descricao || s.id} · {s.valor_centavos} centavos · {s.pagamento ?? "data indisponível"}</option>)}</select></label>
      {saidas.hasNextPage && <button type="button" onClick={() => void saidas.fetchNextPage()}>Mais saídas</button>}
      <label>Referência da conferência <input maxLength={200} value={referencia} onChange={(e) => setReferencia(e.target.value)} /></label>
      <label>Justificativa <textarea maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      {confirmado && confirmado!==confirmacao && <p role="alert">Dados alterados; confira novamente a contrapartida.</p>}
      <label><input type="checkbox" checked={confirmado===confirmacao} onChange={(e) => setConfirmado(e.target.checked?confirmacao:null)} /> Verifiquei que a saída é a contrapartida deste estorno.</label>
      <button type="submit" disabled={confirmado!==confirmacao || estornos.isFetching || saidas.isFetching}>Registrar conferência</button>
    </fieldset></form>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
