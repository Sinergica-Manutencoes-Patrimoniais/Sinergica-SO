import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";
import { pedidoDecisaoOndaSchema, registrarDecisaoOnda, type PedidoDecisaoOnda } from "../../application/decisao-onda";

const verificacoes: Record<number, readonly [string, string][]> = {
  1: [["arvore_busca", "Árvore e busca sem duplicidade"], ["validacao_cadastral", "Validação cadastral"]],
  2: [["envio_t24", "Envio controlado e contrato T−24"]],
  3: [["plano_versoes", "Plano e versionamento"], ["calendario_feriados", "Calendário e feriados"], ["tempos_pendentes", "Tempos pendentes explícitos"], ["questionarios", "Questionários"]],
  4: [["rastreabilidade_duplicidade", "Rastreabilidade e ausência de duplicidade"]],
  5: [["cliente_autorizado", "Cliente piloto autorizado"], ["aquisicao_orcamento", "Aquisição e orçamento"]],
  6: [["cliente_autorizado", "Cliente piloto autorizado"], ["seguranca_cobranca", "Segurança e ausência de cobrança duplicada"]],
};

type Props = { userId: string; clienteId: string; onda: number; revision: number };
export function DecisaoOnda(props: Props) {
  if (import.meta.env.VITE_SSO_DECISAO_ONDA_ENABLED !== "true") return null;
  return <Formulario key={`${props.userId}:${props.clienteId}:${props.onda}`} {...props} />;
}
function Formulario({ userId, clienteId, onda, revision }: Props) {
  const chave = `sso-decisao-onda:${JSON.stringify([userId, clienteId, onda])}`;
  const [pendente, setPendente] = useState<PedidoDecisaoOnda | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const pedido = pedidoDecisaoOndaSchema.parse(JSON.parse(salvo));
      return pedido.clienteId === clienteId && pedido.onda === onda ? pedido : "invalido";
    } catch { return "invalido"; }
  });
  const [versao, setVersao] = useState("");
  const [ambiente, setAmbiente] = useState("");
  const [referencias, setReferencias] = useState<Record<string, string>>({});
  const [ressalva, setRessalva] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const fotografia = JSON.stringify({ userId, clienteId, onda, revision, versao, ambiente, referencias, ressalva });
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const trava = useRef(false);
  const client = useQueryClient();
  async function enviar(pedido: PedidoDecisaoOnda) {
    if (trava.current) return;
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Tentativa local alterada.");
      trava.current = true; setOcupado(true); setAviso("");
      await registrarDecisaoOnda(userId, pedido);
      await client.invalidateQueries({ queryKey: ["sso-decisoes-onda", userId, clienteId, onda] });
      const atual = await supabase.auth.getUser();
      if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Tentativa local alterada após confirmação.");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmado(null);
      setAviso("Decisão funcional registrada. Nenhuma operação externa foi liberada.");
    } catch (erro) {
      const mensagem = typeof erro === "object" && erro !== null && "message" in erro ? erro.message : null;
      const codigo = typeof erro === "object" && erro !== null && "code" in erro ? erro.code : null;
      setAviso(codigo === "23514" && (mensagem === "evidencia_recente_divergente" || mensagem === "evidencia_incompleta_ou_invalida" || mensagem === "data_evidencia_invalida")
        ? "O servidor recusou a decisão por divergência ou dados incompletos nas evidências. A tentativa permanece guardada; confira a onda e procure suporte para reconciliá-la."
        : "Resultado não confirmado. Repita somente a mesma tentativa ou consulte suporte.");
    } finally { trava.current = false; setOcupado(false); }
  }
  async function cancelarTentativa(pedido: PedidoDecisaoOnda) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setAviso("");
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Sessão ou tentativa alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_cancelar_tentativa_decisao_onda", {
        p_ator_id: userId, p_cliente_id: clienteId, p_request_id: pedido.requestId, p_onda: onda,
      });
      if (error) throw error;
      if (!data || data.requestId !== pedido.requestId || data.clienteId !== clienteId || data.onda !== onda || !["cancelado", "confirmado"].includes(data.estado)) throw new Error("Resposta divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Sessão ou tentativa alterada.");
      if (data.estado === "confirmado") { setAviso("A decisão já foi registrada; o cancelamento não a desfaz. Repita o pedido para recuperar o resultado."); return; }
      sessionStorage.removeItem(chave); setPendente(null); setConfirmado(null);
      setAviso("Tentativa cancelada. Nenhuma decisão foi desfeita.");
    } catch { setAviso("Cancelamento não confirmado. A tentativa continua guardada; consulte suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (pendente || trava.current || confirmado !== fotografia) return;
    try {
      const pedido = pedidoDecisaoOndaSchema.parse({ requestId: crypto.randomUUID(), clienteId, onda, revision,
        versao, ambiente, referencias, ressalva });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chave, JSON.stringify(pedido)); setPendente(pedido); void enviar(pedido);
    } catch { setAviso("Confira os campos e a tentativa pendente. Nada foi enviado."); }
  }
  return <section aria-label="Decisão funcional da onda">
    <h4>Decisão funcional experimental</h4>
    <p>Declaração humana sujeita à conferência no servidor. Não comprova CI nem autenticidade e não libera produção, planilhas ou Auvo.</p>
    {pendente === "invalido" && <p role="alert">Tentativa ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <div>
      <p>Tentativa pendente: onda {pendente.onda}, revisão {pendente.revision}, versão {pendente.versao}, ambiente {pendente.ambiente}.</p>
      <ul>{Object.entries(pendente.referencias).map(([nome, valor]) => <li key={nome}>{nome}: {valor}</li>)}</ul>
      {pendente.ressalva && <p>Ressalva: {pendente.ressalva}</p>}
      <button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesma tentativa</button>
      {import.meta.env.VITE_SSO_CANCELAR_TENTATIVA_DECISAO_ONDA_ENABLED === "true" && <button type="button" disabled={ocupado} onClick={() => void cancelarTentativa(pendente)}>Cancelar tentativa</button>}
    </div> : !pendente && <form onSubmit={(evento) => { evento.preventDefault(); iniciar(); }}>
      <p>Fotografia de evidências: revisão {revision}.</p>
      <label>Versão <input required maxLength={120} value={versao} onChange={(e) => { setVersao(e.target.value); setConfirmado(null); }} /></label>
      <label>Ambiente <input required maxLength={120} value={ambiente} onChange={(e) => { setAmbiente(e.target.value); setConfirmado(null); }} /></label>
      {(verificacoes[onda] ?? []).map(([id, descricao]) => <label key={id}>{descricao}: referência sanitizada
        <input required maxLength={200} pattern="[A-Za-z0-9_.:-]+" value={referencias[id] ?? ""} onChange={(e) => { setReferencias((atual) => ({ ...atual, [id]: e.target.value })); setConfirmado(null); }} />
      </label>)}
      <label>Ressalvas <textarea maxLength={2000} value={ressalva} onChange={(e) => { setRessalva(e.target.value); setConfirmado(null); }} /></label>
      {confirmado && confirmado !== fotografia && <p role="alert">A revisão ou os dados mudaram. Confira novamente antes de declarar.</p>}
      <label><input type="checkbox" checked={confirmado === fotografia} onChange={(e) => setConfirmado(e.target.checked ? fotografia : null)} /> Conferi a fotografia e assumo a declaração funcional desta onda.</label>
      <button type="submit" disabled={confirmado !== fotografia || ocupado}>Registrar decisão</button>
    </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
