import { Button } from "@sinergica/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id = z.string().guid();
export const pedidoPromocaoParcialSchema = z.object({ requestId: id, atorId: id, clienteId: id, retornoId: id, retornoRevision: z.number().int().positive(),
  chamadoId: id, parcelaId: id, cicloId: id, titulo: z.string().trim().min(1).max(200), descricao: z.string().max(10000),
  descricaoRestante: z.string().min(1).max(4000), minutosRestantes: z.number().int().positive() }).strict();
type Pedido = z.infer<typeof pedidoPromocaoParcialSchema>;
export const reciboPromocaoParcialSchema = z.object({ requestId: id, clienteId: id, retornoId: id, retornoRevision: z.number().int().positive(), pendenciaId: id,
  chamadoAnteriorId: id, parcelaAnteriorId: id, cicloAnteriorId: id, chamadoId: id, numero: z.string().min(1), parcelaId: id, cicloId: id,
  descricaoRestante: z.string().min(1).max(4000), minutosRestantes: z.number().int().positive(), osCriada: z.literal(false), tarefaCriada: z.literal(false) }).strict();

export function PromoverRetornoParcial({ userId, clienteId, retornoId, revisao, estado, descricaoRestante, minutosRestantes, consultaDisponivel }: {
  userId: string; clienteId: string; retornoId: string; revisao: number; estado: "aguardando" | "promovido";
  descricaoRestante: string; minutosRestantes: number; consultaDisponivel: boolean;
}) {
  const chave = `sso-promocao-retorno-parcial:${userId}:${clienteId}:${retornoId}`;
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave); if (!salvo) return { pedido: null, invalido: false };
      const pedido = pedidoPromocaoParcialSchema.parse(JSON.parse(salvo));
      if (pedido.atorId !== userId || pedido.clienteId !== clienteId || pedido.retornoId !== retornoId) throw new Error("Contexto divergente");
      return { pedido, invalido: false };
    } catch { return { pedido: null, invalido: true }; }
  });
  const [pendente, setPendente] = useState<Pedido | null>(recuperacao.pedido);
  const [titulo, setTitulo] = useState(""); const [descricao, setDescricao] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState("");
  const [recibo, setRecibo] = useState<z.infer<typeof reciboPromocaoParcialSchema> | null>(null);
  const trava = useRef(false); const cache = useQueryClient();
  const fotografia = JSON.stringify({ retornoId, revisao, estado, descricaoRestante, minutosRestantes, titulo: titulo.trim(), descricao });
  const descricaoIncompativel = [...descricaoRestante].length > 1000 || descricaoRestante !== descricaoRestante.trim();
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada"); }
  async function enviar(pedido: Pedido) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso(""); const serializado = JSON.stringify(pedido);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_promover_retorno_parcial", {
        p_request_id: pedido.requestId, p_ator_esperado: pedido.atorId, p_cliente_id: pedido.clienteId, p_retorno_id: pedido.retornoId,
        p_retorno_revision: pedido.retornoRevision, p_chamado_id: pedido.chamadoId, p_parcela_id: pedido.parcelaId, p_ciclo_id: pedido.cicloId,
        p_titulo: pedido.titulo, p_descricao: pedido.descricao });
      if (error) throw error; const r = reciboPromocaoParcialSchema.parse(data);
      if (r.requestId !== pedido.requestId || r.clienteId !== clienteId || r.retornoId !== retornoId || r.retornoRevision !== pedido.retornoRevision + 1
        || r.chamadoId !== pedido.chamadoId || r.parcelaId !== pedido.parcelaId || r.cicloId !== pedido.cicloId
        || r.descricaoRestante !== pedido.descricaoRestante || r.minutosRestantes !== pedido.minutosRestantes) throw new Error("Recibo divergente");
      await conferirAtor(); await cache.invalidateQueries({ queryKey: ["backlog-retornos-parciais", userId, clienteId] }); await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setRecibo(r); setAviso(`Chamado ${r.numero} criado para o restante. Nenhuma OS ou tarefa foi criada.`);
    } catch { setAviso("Não foi possível confirmar a promoção. A tentativa permanece guardada; repita somente o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function consultarRecibo(pedido: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setAviso("");
    const serializado = JSON.stringify(pedido);
    try {
      await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_promocao_retorno_parcial", {
        p_ator_id: userId, p_cliente_id: clienteId, p_retorno_id: retornoId,
      });
      if (error || !data) throw new Error("Recibo indisponível");
      const r = reciboPromocaoParcialSchema.parse(data);
      if (r.requestId !== pedido.requestId || r.clienteId !== pedido.clienteId || r.retornoId !== pedido.retornoId ||
        r.retornoRevision !== pedido.retornoRevision + 1 || r.chamadoId !== pedido.chamadoId ||
        r.parcelaId !== pedido.parcelaId || r.cicloId !== pedido.cicloId ||
        r.descricaoRestante !== pedido.descricaoRestante || r.minutosRestantes !== pedido.minutosRestantes) throw new Error("Recibo divergente");
      await conferirAtor();
      await cache.invalidateQueries({ queryKey: ["backlog-retornos-parciais", userId, clienteId] });
      await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setRecibo(r);
      setAviso(`Chamado ${r.numero} confirmado. Nenhuma OS ou tarefa foi criada.`);
    } catch { setAviso("Recibo indisponível ou divergente. A tentativa permanece guardada; procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (trava.current || pendente || recuperacao.invalido || !consultaDisponivel || estado !== "aguardando" || descricaoIncompativel || confirmacao !== fotografia) return;
    try {
      const pedido = pedidoPromocaoParcialSchema.parse({ requestId: crypto.randomUUID(), atorId: userId, clienteId, retornoId, retornoRevision: revisao,
        chamadoId: crypto.randomUUID(), parcelaId: crypto.randomUUID(), cicloId: crypto.randomUUID(), titulo, descricao, descricaoRestante, minutosRestantes });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(pedido)); setPendente(pedido); void enviar(pedido);
    } catch { setAviso("Não foi possível guardar a tentativa. Confira título e sessão."); }
  }
  return <section aria-label="Promoção do retorno parcial" className="mt-2 rounded-md border border-line p-3">
    <p>O novo Chamado conterá somente o restante declarado, sem criar OS ou tarefa. A parada anterior não está comprovada.</p>
    {recuperacao.invalido ? <p role="alert">Tentativa local inválida. Procure suporte.</p> : pendente ? <>
      <p>Pedido pendente para revisão {pendente.retornoRevision}: {pendente.descricaoRestante} · {pendente.minutosRestantes} min.</p><Button variant="secondary" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</Button>
      {import.meta.env.VITE_SSO_CONSULTA_PROMOCAO_PARCIAL_ENABLED === "true" && <Button variant="secondary" disabled={ocupado} onClick={() => void consultarRecibo(pendente)}>Consultar recibo</Button>}
    </> : estado !== "aguardando" ? <p>Este retorno não está disponível para nova promoção.</p> : <>
      {descricaoIncompativel && <p role="alert">O restante excede o limite atual da parcela ou possui espaços nas bordas. Não será truncado; procure suporte.</p>}
      <label>Título do Chamado <input className="input" maxLength={200} value={titulo} disabled={ocupado || !consultaDisponivel} onChange={(e) => { setTitulo(e.target.value); setConfirmacao(null); }} /></label>
      <label>Descrição do Chamado <textarea className="input" maxLength={10000} value={descricao} disabled={ocupado || !consultaDisponivel} onChange={(e) => { setDescricao(e.target.value); setConfirmacao(null); }} /></label>
      {confirmacao && confirmacao !== fotografia && <p role="alert">Os dados mudaram. Confira novamente.</p>}
      <label><input type="checkbox" checked={confirmacao === fotografia} disabled={ocupado || !consultaDisponivel || descricaoIncompativel} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Confirmo o restante, tempo e revisão exibidos.</label>
      <Button variant="secondary" disabled={ocupado || !consultaDisponivel || descricaoIncompativel || !titulo.trim() || confirmacao !== fotografia} onClick={iniciar}>Criar Chamado do restante</Button>
    </>}{aviso && <p role="status">{aviso}</p>}
    {recibo && <section aria-label="Rastreabilidade da promoção confirmada">
      <h5>Rastreabilidade do restante</h5>
      <p>Pendência {recibo.pendenciaId} · Chamado anterior {recibo.chamadoAnteriorId} · parcela anterior {recibo.parcelaAnteriorId} · ciclo anterior {recibo.cicloAnteriorId}.</p>
      <p>Novo Chamado {recibo.numero} ({recibo.chamadoId}) · nova parcela {recibo.parcelaId} · novo ciclo {recibo.cicloId}.</p>
      <p>Restante declarado: {recibo.descricaoRestante} · {recibo.minutosRestantes} min. O recibo não comprova execução nem parada da OS anterior.</p>
    </section>}
  </section>;
}
