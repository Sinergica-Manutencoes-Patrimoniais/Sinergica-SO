import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { pedidoEvidenciaSchema, registrarEvidenciaOnda, type PedidoEvidencia } from "../../application/registrar-evidencia-onda";

type Props = { userId: string; clienteId: string; onda: number; revision: number | null };

export function RegistrarEvidenciaOnda(props: Props) {
  return <Formulario key={`${props.userId}:${props.clienteId}:${props.onda}`} {...props} />;
}

function Formulario({ userId, clienteId, onda, revision }: Props) {
  const chave = `sso-evidencia-onda:${JSON.stringify([userId, clienteId, onda])}`;
  const [pendente, setPendente] = useState<PedidoEvidencia | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const pedido = pedidoEvidenciaSchema.parse(JSON.parse(salvo));
      return pedido.clienteId === clienteId && pedido.onda === onda ? pedido : "invalido";
    } catch { return "invalido"; }
  });
  const [cenario, setCenario] = useState("");
  const [versao, setVersao] = useState("");
  const [ambiente, setAmbiente] = useState("");
  const [executadoEm, setExecutadoEm] = useState("");
  const [resultado, setResultado] = useState<"passou" | "falhou" | "bloqueado">("passou");
  const [identificadores, setIdentificadores] = useState("");
  const [artefatos, setArtefatos] = useState("");
  const [ressalva, setRessalva] = useState("");
  const [aviso, setAviso] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [fotoConfirmada, setFotoConfirmada] = useState<string | null>(null);
  const foto = JSON.stringify([userId, clienteId, onda, revision, cenario, versao, ambiente, executadoEm, resultado, identificadores, artefatos, ressalva]);
  const confirmado = fotoConfirmada === foto;
  const trava = useRef(false);
  const client = useQueryClient();
  async function conferirSessao(pedido: PedidoEvidencia) {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Sessão ou tentativa alterada.");
  }
  const envio = useMutation({
    mutationFn: async (pedido: PedidoEvidencia) => {
      await conferirSessao(pedido);
      const resposta = await registrarEvidenciaOnda(pedido);
      await conferirSessao(pedido);
      return resposta;
    },
    onSuccess: async (_resposta, pedido) => {
      try {
        await client.invalidateQueries({ queryKey: ["sso-evidencias-onda", userId, clienteId, onda] });
        await conferirSessao(pedido);
        sessionStorage.removeItem(chave);
        setPendente(null);
        setFotoConfirmada(null);
        setAviso("Evidência declarada. A declaração não é aceite ou liberação.");
      } catch {
        setAviso("Evidência confirmada, mas a tentativa local não foi limpa. Consulte suporte.");
      }
    },
    onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."),
    onSettled: () => { trava.current = false; },
  });
  function enviar(pedido: PedidoEvidencia) {
    if (trava.current) return;
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Tentativa alterada.");
      trava.current = true;
      envio.mutate(pedido);
    } catch { setAviso("Tentativa local indisponível ou alterada. Consulte suporte."); }
  }
  async function cancelarTentativa(pedido: PedidoEvidencia) {
    if (trava.current) return;
    trava.current = true; setCancelando(true); setAviso("");
    try {
      await conferirSessao(pedido);
      const { data, error } = await supabase.schema("pcm").rpc("sso_cancelar_tentativa_evidencia_onda", {
        p_ator_id: userId, p_cliente_id: clienteId, p_request_id: pedido.requestId, p_onda: onda,
      });
      if (error) throw error;
      if (!data || data.requestId !== pedido.requestId || data.clienteId !== clienteId || data.onda !== onda || !["cancelado", "confirmado"].includes(data.estado)) throw new Error("Resposta divergente.");
      await conferirSessao(pedido);
      if (data.estado === "confirmado") { setAviso("A evidência já foi registrada; o cancelamento não a desfaz. Repita o pedido para recuperar o resultado."); return; }
      sessionStorage.removeItem(chave); setPendente(null); setFotoConfirmada(null);
      setAviso("Tentativa cancelada. Nenhuma evidência registrada foi apagada.");
    } catch { setAviso("Cancelamento não confirmado. A tentativa continua guardada; consulte suporte."); }
    finally { trava.current = false; setCancelando(false); }
  }
  function iniciar() {
    if (pendente || trava.current || revision === null || !confirmado) return;
    try {
      const lista = (texto: string) => texto.split("\n").map((valor) => valor.trim()).filter(Boolean);
      const pedido = pedidoEvidenciaSchema.parse({ requestId: crypto.randomUUID(), clienteId, onda, expectedRevision: revision,
        cenario, versao, ambiente, executadoEm: new Date(executadoEm).toISOString(), resultado,
        identificadores: lista(identificadores), artefatos: lista(artefatos), ressalva });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chave, JSON.stringify(pedido));
      setPendente(pedido);
      enviar(pedido);
    } catch { setAviso("Confira os campos e a sessão. Nada foi enviado."); }
  }
  return <section aria-label="Declarar evidência de homologação">
    <h4>Declarar evidência</h4>
    <p>Informe referências sem URLs, credenciais ou dados sensíveis. A tentativa fica nesta aba até confirmação.</p>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <p>Há uma tentativa pendente. <button type="button" disabled={cancelando || envio.isPending || revision === null} onClick={() => enviar(pendente)}>Repetir tentativa</button> {import.meta.env.VITE_SSO_CANCELAR_TENTATIVA_EVIDENCIA_ONDA_ENABLED === "true" && <button type="button" disabled={cancelando || envio.isPending} onClick={() => void cancelarTentativa(pendente)}>{cancelando ? "Cancelando…" : "Cancelar tentativa"}</button>}</p>
      : !pendente && <form onSubmit={(evento) => { evento.preventDefault(); iniciar(); }}>
        <label>Cenário CT <input required placeholder="CT-001" value={cenario} onChange={(evento) => setCenario(evento.target.value)} /></label>
        <label>Versão <input required maxLength={120} value={versao} onChange={(evento) => setVersao(evento.target.value)} /></label>
        <label>Ambiente <input required maxLength={120} value={ambiente} onChange={(evento) => setAmbiente(evento.target.value)} /></label>
        <label>Data e hora da execução <input required type="datetime-local" value={executadoEm} onChange={(evento) => setExecutadoEm(evento.target.value)} /></label>
        <label>Resultado <select value={resultado} onChange={(evento) => setResultado(evento.target.value as typeof resultado)}>
          <option value="passou">Passou</option><option value="falhou">Falhou</option><option value="bloqueado">Bloqueado</option>
        </select></label>
        <label>Identificadores, um por linha <textarea required value={identificadores} onChange={(evento) => setIdentificadores(evento.target.value)} /></label>
        <label>Referências de artefatos, uma por linha <textarea required value={artefatos} onChange={(evento) => setArtefatos(evento.target.value)} /></label>
        <label>Ressalvas <textarea maxLength={2000} value={ressalva} onChange={(evento) => setRessalva(evento.target.value)} /></label>
        <label><input type="checkbox" checked={confirmado} onChange={(evento) => setFotoConfirmada(evento.target.checked ? foto : null)} /> Conferi o cenário, resultado, referências e contexto declarados.</label>
        <button type="submit" disabled={envio.isPending || revision === null || !confirmado}>Registrar declaração</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
