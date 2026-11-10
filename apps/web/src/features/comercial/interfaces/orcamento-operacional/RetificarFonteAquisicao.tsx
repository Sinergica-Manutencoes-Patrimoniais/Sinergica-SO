import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { centavosParaEntradaReais, valorReaisParaCentavos } from "../../domain/valor-em-reais";

const uuid = z.string().guid();
const tipoSchema = z.enum(["material", "retirada_exclusiva"]);
const pedidoSchema = z.object({ atorId: uuid, clienteId: uuid, requestId: uuid, fonteAnteriorId: uuid, fonteNovaId: uuid,
  listaId: uuid, listaRevision: z.number().int().positive(), tipo: tipoSchema, descricao: z.string().trim().min(1).max(1000),
  valorCentavos: z.number().int().safe().nonnegative().max(1_000_000_000_000), motivo: z.string().trim().min(1).max(1000),
  modalidade: z.enum(["nao_utilizada", "utilizada"]).optional() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Fonte = { id: string; lista_revisao: number; tipo: z.infer<typeof tipoSchema>; descricao: string; valor_centavos: number };
export function RetificarFonteAquisicao({ usuario, cliente, listaId, listaRevisao, fontes, disponivel }: {
  usuario: string; cliente: string; listaId: string; listaRevisao: number; fontes: Fonte[]; disponivel: boolean;
}) {
  const chave = `sso-retificar-fonte-aquisicao:${JSON.stringify([usuario, cliente, listaId])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null; const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.atorId === usuario && p.clienteId === cliente && p.listaId === listaId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [selecionado, setSelecionado] = useState(""); const [tipo, setTipo] = useState<z.infer<typeof tipoSchema> | "">("");
  const [descricao, setDescricao] = useState(""); const [valor, setValor] = useState(""); const [motivo, setMotivo] = useState("");
  const [modalidade, setModalidade] = useState<"nao_utilizada" | "utilizada">("nao_utilizada");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(""); const trava = useRef(false); const cache = useQueryClient();
  const fonte = fontes.find((x) => x.id === selecionado);
  const valorCentavos = valorReaisParaCentavos(valor);
  const fotografia = JSON.stringify({ usuario, cliente, listaId, listaRevisao, fonte, modalidade, tipo, descricao: descricao.trim(), valor, motivo: motivo.trim() });
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== usuario) throw new Error("Sessão alterada"); }
  async function enviar(p: Pedido) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso(""); const serializado = JSON.stringify(p);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("comercial").rpc(p.modalidade === "utilizada" ? "sso_retificar_fonte_utilizada" : "sso_retificar_fonte_aquisicao", {
        p_ator_id: p.atorId, p_cliente_id: p.clienteId, p_request_id: p.requestId, p_fonte_anterior_id: p.fonteAnteriorId,
        p_fonte_nova_id: p.fonteNovaId, p_lista_id: p.listaId, p_lista_revision: p.listaRevision, p_tipo: p.tipo,
        p_descricao: p.descricao, p_valor_centavos: p.valorCentavos, p_motivo: p.motivo,
      });
      if (error) throw error;
      const r = z.object({ requestId: uuid, clienteId: uuid, fonteId: uuid, fonteAnteriorId: uuid, listaId: uuid,
        listaRevision: z.number().int().positive(), tipo: tipoSchema, valorCentavos: z.number().int().safe().nonnegative(),
        despesaVisitaCriada: z.literal(false), faturavelCriado: z.literal(false), historicoPreservado: z.literal(true),
        propostaReservadaId: uuid.optional(), orcamentoAlterado: z.literal(false).optional() }).strict().parse(data);
      if (r.requestId !== p.requestId || r.clienteId !== p.clienteId || r.fonteId !== p.fonteNovaId || r.fonteAnteriorId !== p.fonteAnteriorId ||
        r.listaId !== p.listaId || r.listaRevision !== p.listaRevision || r.tipo !== p.tipo || r.valorCentavos !== p.valorCentavos ||
        (p.modalidade === "utilizada" ? !r.propostaReservadaId || r.orcamentoAlterado !== false : r.propostaReservadaId !== undefined || r.orcamentoAlterado !== undefined)) throw new Error("Recibo divergente");
      await conferirAtor(); await cache.invalidateQueries({ queryKey: ["orcamento-fontes-aquisicao", usuario, cliente, listaId] });
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setSelecionado(""); setConfirmacao(null); setMotivo("");
      setAviso(p.modalidade === "utilizada" ? "Fonte substituída e reservada à proposta anterior. Orçamento existente não foi alterado; revise-o antes de uso." : "Fonte substituída; registro anterior preservado e nenhuma cobrança criada.");
    } catch { setAviso("Resultado não confirmado. Repita o mesmo pedido ou procure suporte; fonte já usada exige revisão do orçamento."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    const centavos = valorReaisParaCentavos(valor);
    if (trava.current || pendente || !disponivel || !fonte || confirmacao !== fotografia || centavos === null || centavos > 1_000_000_000_000) return;
    try {
      const p = pedidoSchema.parse({ atorId: usuario, clienteId: cliente, requestId: crypto.randomUUID(), fonteAnteriorId: fonte.id,
        fonteNovaId: crypto.randomUUID(), listaId, listaRevision: listaRevisao, tipo, descricao, valorCentavos: centavos, motivo, modalidade });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setAviso("Confira fonte, motivo, valor e sessão. Nada foi enviado."); }
  }
  return <section aria-label="Retificar fonte de aquisição">
    <h5>Retificar fonte de aquisição</h5><p>A fonte anterior será preservada. Orçamentos existentes não são alterados e precisam de revisão.</p>
    {pendente === "invalido" ? <p role="alert">Tentativa inválida. Procure suporte.</p> : pendente ? <>
      <p>Há uma tentativa pendente; o resultado pode ser incerto.</p><button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</button>
    </> : <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
      {import.meta.env.VITE_SSO_RETIFICAR_FONTE_UTILIZADA_ENABLED === "true" && <label>Uso da fonte <select value={modalidade} disabled={ocupado || !disponivel} onChange={(e) => { setModalidade(e.target.value === "utilizada" ? "utilizada" : "nao_utilizada"); setConfirmacao(null); }}>
        <option value="nao_utilizada">Ainda não utilizada</option><option value="utilizada">Já utilizada em orçamento</option></select></label>}
      {modalidade === "utilizada" && <p>A nova fonte ficará reservada à mesma proposta; nenhum orçamento será alterado automaticamente.</p>}
      <label>Fonte <select value={selecionado} disabled={!disponivel || ocupado} required onChange={(e) => {
        const atual = fontes.find((x) => x.id === e.target.value); setSelecionado(e.target.value); setTipo(atual?.tipo ?? "");
        setDescricao(atual?.descricao ?? ""); setValor(atual ? centavosParaEntradaReais(String(atual.valor_centavos)) : ""); setConfirmacao(null);
      }}><option value="">Selecione</option>{fontes.map((f) => <option key={f.id} value={f.id}>{f.descricao} · {f.valor_centavos} centavos</option>)}</select></label>
      <label>Tipo <select required value={tipo} onChange={(e) => { const t = e.target.value; setTipo(t === "material" || t === "retirada_exclusiva" ? t : ""); setConfirmacao(null); }}>
        <option value="">Selecione</option><option value="material">Material</option><option value="retirada_exclusiva">Retirada exclusiva</option></select></label>
      <label>Nova descrição <textarea required maxLength={1000} value={descricao} onChange={(e) => { setDescricao(e.target.value); setConfirmacao(null); }} /></label>
      <label>Novo valor em reais <input type="text" inputMode="decimal" maxLength={24} required value={valor} onChange={(e) => { setValor(e.target.value); setConfirmacao(null); }} /></label>
      <p>Use vírgula para centavos, por exemplo 150,00.</p>
      {valor.trim() && valorCentavos === null && <p role="alert">Informe um valor válido em reais, com até duas casas decimais.</p>}
      <label>Motivo <textarea required maxLength={1000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      <label><input type="checkbox" checked={confirmacao === fotografia} disabled={!disponivel || !fonte || !tipo || !descricao.trim() || valorCentavos === null || !motivo.trim() || ocupado}
        onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi a fonte anterior e os novos dados.</label>
      <button type="submit" disabled={!disponivel || !fonte || !tipo || !descricao.trim() || valorCentavos === null || !motivo.trim() || ocupado || confirmacao !== fotografia}>Retificar fonte</button>
    </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
