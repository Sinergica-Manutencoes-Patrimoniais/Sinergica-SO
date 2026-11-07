import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().guid();
const pedidoSchema = z.object({ requestId: uuid, atorId: uuid, clienteId: uuid, osIds: z.array(uuid).min(1).max(50) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;

export function ObservarOrdens({ userId, clienteId, ordens, disponivel }: {
  userId: string; clienteId: string; ordens: { id: string; numero: string }[]; disponivel: boolean;
}) {
  const chave = `sso-observar-ordens:${JSON.stringify([userId, clienteId])}`;
  const [pedido, setPedido] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo));
      if (p.atorId !== userId || p.clienteId !== clienteId || new Set(p.osIds.map((id) => id.toLowerCase())).size !== p.osIds.length) return "invalido";
      return p;
    } catch { return "invalido"; }
  });
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const trava = useRef(false);
  const cache = useQueryClient();
  const idsExibidos = new Set(ordens.map((o) => o.id.toLowerCase()));
  const listaUnica = idsExibidos.size === ordens.length;
  const selecaoDisponivel = listaUnica && selecionadas.length > 0 && selecionadas.length <= 50 && selecionadas.every((id) => idsExibidos.has(id.toLowerCase()));
  const fotografia = JSON.stringify({ clienteId, ordens: ordens.filter((o) => selecionadas.some((id) => id.toLowerCase() === o.id.toLowerCase())), selecionadas });
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada"); }
  async function enviar(p: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setMensagem("");
    const serializado = JSON.stringify(p);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_observar_os_reconciliacao", {
        p_ator_id: p.atorId, p_cliente_id: p.clienteId, p_request_id: p.requestId, p_os_ids: p.osIds,
      });
      if (error) throw error;
      const resposta = z.object({ requestId: uuid, clienteId: uuid, efeitoRemotoComprovado: z.literal(false),
        itens: z.array(z.object({ osId: uuid, revisao: z.number().int().positive(),
          estado: z.enum(["incerto", "vinculo_observado_nao_confirmado"]) }).strict()).max(50) }).strict().parse(data);
      const recebidas = resposta.itens.map((i) => i.osId.toLowerCase()).sort();
      if (resposta.requestId.toLowerCase() !== p.requestId.toLowerCase() || resposta.clienteId.toLowerCase() !== p.clienteId.toLowerCase() ||
        JSON.stringify(recebidas) !== JSON.stringify(p.osIds.map((id) => id.toLowerCase()).sort())) throw new Error("Recibo divergente");
      await conferirAtor(); await Promise.all([
        cache.invalidateQueries({ queryKey: ["reconciliacao-os", userId, clienteId] }),
        cache.invalidateQueries({ queryKey: ["reconciliacao-os-observacoes", userId, clienteId] }),
      ]);
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPedido(null); setSelecionadas([]); setConfirmacao(null);
      setMensagem("Observação local registrada. Nenhum efeito remoto foi comprovado.");
    } catch { setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (pedido || trava.current || !disponivel || !selecaoDisponivel || confirmacao !== fotografia) return;
    try {
      const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), atorId: userId, clienteId, osIds: [...selecionadas].sort() });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPedido(p); void enviar(p);
    } catch { setMensagem("Não foi possível guardar a tentativa. Nada foi enviado."); }
  }
  return <section aria-label="Registrar observação local de OS">
    <h4>Observar OS selecionadas</h4>
    <p>O registro reflete apenas o estado local; não consulta ou altera o Auvo.</p>
    {pedido === "invalido" ? <p role="alert">Tentativa guardada inválida. Procure suporte.</p> : pedido ? <>
      <p>Há uma tentativa pendente para {pedido.osIds.length} OS; o resultado pode ser incerto.</p>
      <button type="button" disabled={ocupado} onClick={() => void enviar(pedido)}>Repetir mesmo pedido</button>
    </> : <>
      <fieldset disabled={!disponivel || ocupado}><legend>OS carregadas (até 50)</legend>
        {ordens.map((o) => <label key={o.id}><input type="checkbox" checked={selecionadas.some((id) => id.toLowerCase() === o.id.toLowerCase())} onChange={(e) => {
          const marcado = e.target.checked;
          setSelecionadas((atuais) => marcado ? [...atuais, o.id] : atuais.filter((id) => id.toLowerCase() !== o.id.toLowerCase())); setConfirmacao(null);
        }} /> OS {o.numero}</label>)}
      </fieldset>
      {selecionadas.length > 50 && <p role="alert">Selecione no máximo 50 OS.</p>}
      {!listaUnica && <p role="alert">A lista contém OS repetidas. Atualize antes de registrar observações.</p>}
      {!selecaoDisponivel && selecionadas.length > 0 && <p role="alert">Revise a seleção; alguma OS não está mais carregada ou o limite foi excedido.</p>}
      <label><input type="checkbox" checked={confirmacao === fotografia} disabled={!disponivel || ocupado || !selecaoDisponivel}
        onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Confirmo a seleção apresentada.</label>
      <button type="button" disabled={!disponivel || ocupado || !selecaoDisponivel || confirmacao !== fotografia} onClick={iniciar}>Registrar observação</button>
    </>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
