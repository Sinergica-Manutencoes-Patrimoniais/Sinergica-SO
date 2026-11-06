import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedido = z.object({ requestId: z.string().uuid(), propostaId: z.string().uuid(), revisao: z.number().int().positive(), modo: z.enum(["integral", "linhas"]), motivo: z.string().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedido>;
export function CorrigirModoProposta({ usuario, cliente }: { usuario: string; cliente: string }) {
  const chave = `sso-correcao-modo:${JSON.stringify([usuario, cliente])}`; const cache = useQueryClient();
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); return s ? pedido.parse(JSON.parse(s)) : null; } catch { return "invalido"; } });
  const [id, setId] = useState(""); const [selecionada, setSelecionada] = useState(""); const [motivo, setMotivo] = useState(""); const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const chaveConsulta = ["modo-faturamento-proposta", usuario, cliente, selecionada];
  const consulta = useQuery({ queryKey: chaveConsulta, enabled: !!selecionada, gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("financeiro").rpc("sso_consultar_modo_proposta", { p_cliente_id: cliente, p_proposta_id: selecionada }).abortSignal(signal);
      if (error) throw error; return z.array(z.object({ modo: z.enum(["integral", "linhas"]), revisao: z.number().int().positive() }).strict()).length(1).parse(data)[0]!; } });
  const comando = useMutation({ mutationFn: async (p: Pedido) => { const { data, error } = await supabase.schema("financeiro").rpc("sso_corrigir_modo_proposta", {
    p_request_id: p.requestId, p_cliente_id: cliente, p_proposta_id: p.propostaId, p_revisao: p.revisao, p_modo: p.modo, p_motivo: p.motivo });
    if (error) throw error; if (z.number().int().parse(data) !== p.revisao + 1) throw new Error("Resposta divergente");
  }, onSuccess: async (_r, p) => { try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setAviso("Correção registrada, sem cobrança."); await cache.invalidateQueries({ queryKey: ["modo-faturamento-proposta", usuario, cliente, p.propostaId] });
  }, onError: () => setAviso("Resultado não confirmado. Repita o pedido ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (enviando.current) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar() { if (pendente || enviando.current || consulta.isFetching || consulta.isError || !consulta.data) return; try {
    const p = pedido.parse({ requestId: crypto.randomUUID(), propostaId: selecionada, revisao: consulta.data.revisao, modo: consulta.data.modo === "integral" ? "linhas" : "integral", motivo: motivo.trim() });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Confira o motivo e a sessão. Nada foi enviado."); } }
  if (import.meta.env.VITE_SSO_CORRECAO_MODO_PROPOSTA_ENABLED !== "true") return null;
  return <section><h3>Corrigir modo de proposta</h3><p>Não é permitido corrigir com candidato ativo ou alocação histórica; o histórico é preservado.</p>
    <form onSubmit={(e) => { e.preventDefault(); if (z.string().uuid().safeParse(id.trim()).success) setSelecionada(id.trim()); else setAviso("Informe identificador válido."); }}>
      <label>Proposta <input required value={id} onChange={(e) => setId(e.target.value)} /></label><button type="submit">Consultar modo</button>
    </form>
    {selecionada && consulta.isFetching && <p>Consultando modo…</p>}
    {selecionada && consulta.isError && <p role="alert">Modo indisponível ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <p>Modo atual: {consulta.data.modo} · revisão {consulta.data.revisao}.</p>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={comando.isPending} onClick={() => enviar(pendente)}>Repetir pedido</button> :
      !pendente && consulta.data && !consulta.isFetching && !consulta.isError && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <label>Motivo da correção <input required maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
        <button type="submit" disabled={comando.isPending}>Corrigir para {consulta.data.modo === "integral" ? "linhas" : "integral"}</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
