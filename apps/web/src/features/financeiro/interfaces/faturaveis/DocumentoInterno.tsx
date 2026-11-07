import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { HistoricoDocumentosInternos } from "./HistoricoDocumentosInternos";

const contexto = z.object({ itemId: z.string().guid(), revisaoItem: z.number().int().positive(), estadoItem: z.string(), selecao: z.object({ id: z.string().guid(), revisaoItem: z.number().int(), saldoCentavos: z.string() }).strict().nullable(), documento: z.object({ id: z.string().guid(), revisaoItem: z.number().int(), valorCentavos: z.string(), estado: z.enum(["reservado", "liberado", "convertido"]) }).strict().nullable(), fiscal: z.literal(false), cobrancaEnviada: z.literal(false) }).strict();
const saldoSchema = z.object({ itemId: z.string().guid(), revisao: z.number().int().positive(), situacao: z.enum(["nao_conferido", "divergente", "calculado"]), conferidoCentavos: z.string().nullable(), alocadoCentavos: z.string().nullable(), reservadoCentavos: z.string().nullable(), disponivelCentavos: z.string().nullable() }).strict();
const pedido = z.object({ requestId: z.string().guid(), cliente: z.string().guid(), itemId: z.string().guid(), acao: z.enum(["selecionar", "emitir", "liberar", "converter"]), parametros: z.record(z.string(), z.union([z.string(), z.number()])) }).strict();
type Pedido = z.infer<typeof pedido>;
export function DocumentoInterno({ usuario, cliente, itemId }: { usuario: string; cliente: string; itemId: string }) {
  const chave = `documento-interno:${JSON.stringify([usuario, cliente, itemId])}`; const cache = useQueryClient(); const travado = useRef(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedido.parse(JSON.parse(raw)); return p.cliente === cliente && p.itemId === itemId ? p : "invalido"; } catch { return "invalido"; } });
  const [confirmado, setConfirmado] = useState(false); const [motivo, setMotivo] = useState(""); const [lancamento, setLancamento] = useState(""); const [referencia, setReferencia] = useState(""); const [data, setData] = useState(""); const [valorParcela, setValorParcela] = useState(""); const [mensagem, setMensagem] = useState("");
  const queryKey = ["documento-interno-contexto", usuario, cliente, itemId] as const;
  const consulta = useQuery({ queryKey, gcTime: 0, staleTime: 0, retry: false, queryFn: async ({ signal }) => { const { data: resposta, error } = await supabase.schema("financeiro").rpc("sso_contexto_documento_interno", { p_cliente_id: cliente, p_item_id: itemId }).abortSignal(signal); if (error) throw error; const c = contexto.parse(resposta); if (c.itemId !== itemId) throw new Error("Item divergente"); return c; } });
  const saldo = useQuery({ queryKey: [...queryKey, "saldo"], gcTime: 0, staleTime: 0, retry: false, queryFn: async ({ signal }) => { const { data: resposta, error } = await supabase.schema("financeiro").rpc("sso_saldo_documento_interno", { p_cliente_id: cliente, p_item_id: itemId }).abortSignal(signal); if (error) throw error; const s = saldoSchema.parse(resposta); if (s.itemId !== itemId) throw new Error("Item divergente"); return s; } });
  const comando = useMutation({ mutationFn: async (p: Pedido) => {
    const nomes = { selecionar: "sso_selecionar_faturavel_documento", emitir: "sso_emitir_documento_interno_parcial", liberar: "sso_liberar_reserva_interna", converter: "sso_converter_reserva_interna" } as const;
    const { data: resposta, error } = await supabase.schema("financeiro").rpc(nomes[p.acao], { p_request_id: p.requestId, ...p.parametros }); if (error) throw error;
    const r = z.object({ requestId: z.string().guid() }).passthrough().parse(resposta); if (r.requestId !== p.requestId) throw new Error("Resposta divergente");
    if (p.acao === "selecionar" && (r.itemId !== p.itemId || r.estado !== "selecao_local_nao_emitida" || r.reservaSaldo !== false)) throw new Error("Resposta inválida");
    if (p.acao !== "selecionar" && r.cobrancaEnviada !== false) throw new Error("Resposta inválida");
  } });
  const enviar = async (p: Pedido) => {
    if (travado.current) return;
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente"); }
    catch { setMensagem("Tentativa local mudou ou está indisponível. Procure suporte antes de repetir."); return; }
    travado.current = true;
    try {
      await comando.mutateAsync(p);
      let limpa = false;
      try { if (sessionStorage.getItem(chave) === JSON.stringify(p)) { sessionStorage.removeItem(chave); limpa = true; } } catch { /* Preservar tentativa quando armazenamento falha. */ }
      if (limpa) { setPendente(null); setConfirmado(false); setMensagem("Operação interna registrada. Nenhuma cobrança externa foi enviada."); }
      else setMensagem("Operação interna registrada, mas tentativa local mudou ou não pôde ser removida. Procure suporte.");
      await Promise.all([cache.invalidateQueries({ queryKey }), cache.invalidateQueries({ queryKey: ["faturaveis", usuario, cliente] }), cache.invalidateQueries({ queryKey: ["documento-interno-historico", usuario, cliente, itemId] })]);
    } catch { setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte; não crie outro enquanto houver dúvida."); }
    finally { travado.current = false; }
  };
  const iniciar = (acao: Pedido["acao"]) => { const c = consulta.data; if (!c || consulta.isFetching || consulta.isError || saldo.isFetching || saldo.isError || !saldo.data || saldo.data.revisao !== c.revisaoItem || saldo.data.situacao !== "calculado" || pendente || travado.current || !confirmado) return;
    let parametros: Pedido["parametros"];
    if (acao === "selecionar") parametros = { p_item_id: itemId, p_expected_revision: c.revisaoItem };
    else if (acao === "emitir" && c.selecao && /^[1-9][0-9]{0,15}$/.test(valorParcela) && saldo.data.disponivelCentavos !== null && BigInt(valorParcela) <= BigInt(saldo.data.disponivelCentavos)) parametros = { p_selecao_id: c.selecao.id, p_valor_centavos: valorParcela };
    else if (acao === "liberar" && c.documento && motivo.trim()) parametros = { p_documento_id: c.documento.id, p_revisao: c.revisaoItem, p_motivo: motivo.trim() };
    else if (acao === "converter" && c.documento && motivo.trim() && z.string().guid().safeParse(lancamento).success && referencia.trim() && data) parametros = { p_documento_id: c.documento.id, p_revisao: c.revisaoItem, p_alocacao_id: crypto.randomUUID(), p_lancamento_id: lancamento, p_documento_ref: referencia.trim(), p_data_documento: data, p_motivo: motivo.trim() };
    else { setMensagem("Confira os campos exigidos."); return; }
    const p = pedido.parse({ requestId: crypto.randomUUID(), cliente, itemId, acao, parametros }); try { if (sessionStorage.getItem(chave)) { setMensagem("Existe pedido anterior; reabra para recuperar."); return; } sessionStorage.setItem(chave, JSON.stringify(p)); } catch { setMensagem("Não foi possível guardar o pedido; nada foi enviado."); return; } setPendente(p); void enviar(p);
  };
  const c = consulta.data;
  return <section aria-label="Documento interno e reserva"><h4>Documento interno e reserva</h4><p>Documento não fiscal. Não cria lançamento nem envia cobrança. Confirme lançamento existente antes de converter; reserva pode bloquear alocação até liberação.</p>
    <HistoricoDocumentosInternos usuario={usuario} cliente={cliente} itemId={itemId} />
    {consulta.isFetching && <output>Consultando contexto...</output>}{consulta.isError && <p role="alert">Contexto indisponível ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
    {saldo.isFetching && <output>Consultando saldo...</output>}{saldo.isError && <p role="alert">Saldo indisponível. <button type="button" onClick={() => void saldo.refetch()}>Reconsultar saldo</button></p>}{saldo.data && !saldo.isFetching && !saldo.isError && <p>Saldo {saldo.data.situacao}: conferido {saldo.data.conferidoCentavos ?? "desconhecido"}, alocado {saldo.data.alocadoCentavos ?? "desconhecido"}, reservado {saldo.data.reservadoCentavos ?? "desconhecido"}, disponível {saldo.data.disponivelCentavos ?? "desconhecido"} centavos. Valores são revalidados ao executar.</p>}
    {c && !consulta.isFetching && !consulta.isError && <><p>Item: {c.estadoItem}, revisão {c.revisaoItem}. {c.selecao ? `Seleção ${c.selecao.id}, saldo observado ${c.selecao.saldoCentavos} centavos.` : "Sem seleção."} {c.documento ? `Documento ${c.documento.id}: ${c.documento.estado}, valor ${c.documento.valorCentavos} centavos.` : "Sem documento interno."}</p>
      <label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} disabled={!!pendente} /> Conferi o item e entendo que não há cobrança externa.</label>{" "}
      {c.documento?.estado !== "reservado" && <button type="button" disabled={!confirmado || !!pendente || comando.isPending || c.selecao?.revisaoItem === c.revisaoItem} onClick={() => iniciar("selecionar")}>Selecionar saldo</button>}{" "}
      {c.documento?.estado !== "reservado" && c.selecao && <><label>Valor da próxima parcela em centavos <input inputMode="numeric" value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} disabled={!!pendente} /></label><button type="button" disabled={!confirmado || !!pendente || comando.isPending} onClick={() => iniciar("emitir")}>Criar documento interno e reservar parcela</button></>}
      {c.documento?.estado === "reservado" && <><label>Motivo <input maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={!!pendente} /></label>{" "}<button type="button" disabled={!confirmado || !!pendente || comando.isPending} onClick={() => iniciar("liberar")}>Liberar reserva</button>
        <label>UUID do lançamento existente <input value={lancamento} onChange={(e) => setLancamento(e.target.value)} disabled={!!pendente} /></label><label>Referência do documento <input maxLength={200} value={referencia} onChange={(e) => setReferencia(e.target.value)} disabled={!!pendente} /></label><label>Data do documento <input type="date" value={data} onChange={(e) => setData(e.target.value)} disabled={!!pendente} /></label><button type="button" disabled={!confirmado || !!pendente || comando.isPending} onClick={() => iniciar("converter")}>Converter em alocação existente</button></>}
    </>}
    {pendente === "invalido" && <p role="alert">Pedido guardado ilegível. Procure suporte.</p>}{pendente && pendente !== "invalido" && <button type="button" disabled={comando.isPending} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</button>}{mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
