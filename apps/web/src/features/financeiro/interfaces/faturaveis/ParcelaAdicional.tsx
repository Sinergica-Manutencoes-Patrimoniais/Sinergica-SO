import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { PreviaImpedimentosParcela } from "./PreviaImpedimentosParcela";

const pedido = z.object({ requestId: z.string().guid(), alocacaoId: z.string().guid(), cliente: z.string().guid(), itemId: z.string().guid(), revisao: z.number().int().positive(), documentoId: z.string().guid(), valorCentavos: z.number().int().positive().safe() }).strict();
type Pedido = z.infer<typeof pedido>;
function explicarFalha(erro: unknown) {
  const codigo = typeof erro === "object" && erro !== null && "code" in erro && typeof erro.code === "string" ? erro.code : "";
  if (codigo === "40001") return "A última tentativa encontrou revisão ou contexto divergente.";
  if (codigo === "23505") return "A última tentativa encontrou conflito de identidade ou unicidade.";
  if (codigo === "23514" || codigo === "22023") return "A última tentativa foi rejeitada por uma validação de dados ou saldo.";
  if (codigo === "42501") return "A última tentativa foi negada por acesso ou dados inválidos.";
  if (codigo === "55000") return "A última tentativa encontrou o fluxo indisponível ou bloqueado.";
  return "O resultado da última tentativa não foi confirmado.";
}
export function ParcelaAdicional({ usuario, cliente, itemId, documentoId, revisao, saldo }: { usuario: string; cliente: string; itemId: string; documentoId: string; revisao: number; saldo: number }) {
  const chave = `parcela-adicional:${JSON.stringify([usuario, cliente, itemId, documentoId])}`; const cache = useQueryClient(); const travado = useRef(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedido.parse(JSON.parse(raw)); return p.cliente === cliente && p.itemId === itemId && p.documentoId === documentoId ? p : "invalido"; } catch { return "invalido"; } });
  const [valor, setValor] = useState(""); const [confirmado, setConfirmado] = useState<string | null>(null); const [mensagem, setMensagem] = useState("");
  const fotografia=JSON.stringify({usuario,cliente,itemId,documentoId,revisao,saldo,valor});
  const comando = useMutation({ mutationFn: async (p: Pedido) => { const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou pedido alterado.");const { data, error } = await supabase.schema("financeiro").rpc("sso_alocar_parcela_adicional", { p_request_id: p.requestId, p_alocacao_id: p.alocacaoId, p_cliente_id: p.cliente, p_item_id: p.itemId, p_expected_revision: p.revisao, p_documento_id: p.documentoId, p_valor_centavos: p.valorCentavos }); if (error) throw error;
    const r = z.object({ requestId: z.string().guid(), aggregateId: z.string().guid(), revision: z.number().int(), state: z.enum(["parcial", "faturado"]), linkedIds: z.object({ alocacaoId: z.string().guid(), documentoId: z.string().guid(), lancamentoId: z.string().guid() }).passthrough() }).passthrough().parse(data);
    if (r.requestId !== p.requestId || r.aggregateId !== p.itemId || r.revision !== p.revisao + 1 || r.linkedIds.alocacaoId !== p.alocacaoId || r.linkedIds.documentoId !== p.documentoId) throw new Error("Resposta divergente");const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario)throw new Error("Sessão alterada."); } });
  const enviar = async (p: Pedido) => {
    if (travado.current) return;
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente"); }
    catch { setMensagem("Pedido local mudou ou está indisponível. Procure suporte antes de repetir."); return; }
    travado.current = true;
    try {
      await comando.mutateAsync(p);
      await Promise.all([cache.invalidateQueries({ queryKey: ["faturaveis", usuario, cliente] }), cache.invalidateQueries({ queryKey: ["faturavel-saldo", usuario, cliente, itemId] }), cache.invalidateQueries({ queryKey: ["faturavel-previa-parcela-documento", usuario, cliente, itemId] }), cache.invalidateQueries({ queryKey: ["faturavel-pedidos-proprios", usuario, cliente, itemId] })]);
      let limpa = false;
      try { const atual=await supabase.auth.getUser();if (!atual.error&&atual.data.user?.id===usuario&&sessionStorage.getItem(chave) === JSON.stringify(p)) { sessionStorage.removeItem(chave); limpa = true; } } catch { /* Preservar tentativa divergente. */ }
      if (limpa) { setPendente(null); setConfirmado(null); setValor(""); setMensagem("Parcela registrada no documento existente; nenhuma cobrança externa foi enviada."); }
      else setMensagem("Parcela registrada, mas o pedido local mudou ou não pôde ser removido. Procure suporte.");
    } catch (erro) { setMensagem(`${explicarFalha(erro)} Uma tentativa anterior pode ter sido registrada; consulte o pedido pelo identificador ou procure suporte. O pedido foi preservado.`); }
    finally { travado.current = false; }
  };
  return <section aria-label="Parcela adicional"><h5>Parcela adicional no documento</h5><p>Exige parcela anterior para este item e documento. O servidor revalida revisão e saldos; não há cobrança externa.</p>
    {import.meta.env.VITE_SSO_PREVIA_IMPEDIMENTOS_PARCELA_ENABLED === "true" && <PreviaImpedimentosParcela usuario={usuario} cliente={cliente} itemId={itemId} documentoId={documentoId} revisao={revisao} valor={valor} />}
    <form onSubmit={(e) => { e.preventDefault(); if (pendente || travado.current || confirmado!==fotografia) return; const parsed = pedido.safeParse({ requestId: crypto.randomUUID(), alocacaoId: crypto.randomUUID(), cliente, itemId, revisao, documentoId, valorCentavos: /^\d+$/.test(valor) ? Number(valor) : NaN }); if (!parsed.success || parsed.data.valorCentavos > saldo) { setMensagem("Confira o valor e o saldo do item."); return; } try { if (sessionStorage.getItem(chave)) { setMensagem("Existe pedido anterior; recupere-o antes de continuar."); return; } sessionStorage.setItem(chave, JSON.stringify(parsed.data)); } catch { setMensagem("Não foi possível guardar o pedido; nada foi enviado."); return; } setPendente(parsed.data); void enviar(parsed.data); }}>
      <label>Valor em centavos <input inputMode="numeric" value={valor} disabled={!!pendente || comando.isPending} onChange={(e) => setValor(e.target.value)} /></label>{" "}
      {confirmado && confirmado!==fotografia && <p role="alert">Valor, saldo ou revisão mudou; confira novamente.</p>}
      <label><input type="checkbox" checked={confirmado===fotografia} disabled={!!pendente || comando.isPending} onChange={(e) => setConfirmado(e.target.checked?fotografia:null)} /> Confirmei documento, item e valor.</label>{" "}<button type="submit" disabled={confirmado!==fotografia || !!pendente || comando.isPending}>Registrar parcela adicional</button>
    </form>
    {pendente === "invalido" && <p role="alert">Pedido ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" && <><p>Identificador do pedido: {pendente.requestId}</p><button type="button" disabled={comando.isPending} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</button></>}{mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
