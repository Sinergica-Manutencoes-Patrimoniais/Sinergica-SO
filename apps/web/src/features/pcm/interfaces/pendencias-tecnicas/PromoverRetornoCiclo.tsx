import { Button } from "@sinergica/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const pedidoSchema = z.object({ requestId: uuid, atorId: uuid, clienteId: uuid, retornoId: uuid,
  retornoRevision: z.number().int().positive(), chamadoId: uuid, parcelaId: uuid, cicloId: uuid,
  titulo: z.string().trim().min(1).max(200), descricao: z.string().max(10000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const reciboSchema = z.object({ requestId: uuid, clienteId: uuid, retornoId: uuid, retornoRevision: z.number().int().positive(),
  pendenciaId: uuid, chamadoAnteriorId: uuid, parcelaAnteriorId: uuid, cicloAnteriorId: uuid,
  chamadoId: uuid, numero: z.string().min(1), parcelaId: uuid, cicloId: uuid,
  osCriada: z.literal(false), tarefaCriada: z.literal(false) }).strict();

export function PromoverRetornoCiclo({ userId, clienteId, retornoId, revisao, estado, consultaDisponivel }: {
  userId: string; clienteId: string; retornoId: string; revisao: number; estado: "aguardando" | "promovido"; consultaDisponivel: boolean;
}) {
  const chave = `sso-promocao-retorno:${userId}:${clienteId}:${retornoId}`;
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave); if (!salvo) return { pedido: null, invalido: false };
      const pedido = pedidoSchema.parse(JSON.parse(salvo));
      if (pedido.atorId !== userId || pedido.clienteId !== clienteId || pedido.retornoId !== retornoId) throw new Error("Contexto divergente");
      return { pedido, invalido: false };
    } catch { return { pedido: null, invalido: true }; }
  });
  const [pendente, setPendente] = useState<Pedido | null>(recuperacao.pedido);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [confirmacao, setConfirmacao] = useState(false);
  const [revisaoConfirmada, setRevisaoConfirmada] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const trava = useRef(false);
  const cache = useQueryClient();
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada"); }
  async function enviar(pedido: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setAviso("");
    const serializado = JSON.stringify(pedido);
    try {
      await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_promover_retorno_ciclo", {
        p_request_id: pedido.requestId, p_ator_esperado: pedido.atorId, p_cliente_id: pedido.clienteId,
        p_retorno_id: pedido.retornoId, p_retorno_revision: pedido.retornoRevision, p_chamado_id: pedido.chamadoId,
        p_parcela_id: pedido.parcelaId, p_ciclo_id: pedido.cicloId, p_titulo: pedido.titulo, p_descricao: pedido.descricao,
      });
      if (error) throw error;
      const resultado = reciboSchema.parse(data);
      if (resultado.requestId !== pedido.requestId || resultado.clienteId !== clienteId || resultado.retornoId !== retornoId || resultado.retornoRevision !== pedido.retornoRevision + 1 || resultado.chamadoId !== pedido.chamadoId || resultado.parcelaId !== pedido.parcelaId || resultado.cicloId !== pedido.cicloId) throw new Error("Recibo divergente");
      await conferirAtor();
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["backlog-retornos-ciclo", userId, clienteId] }),
        cache.invalidateQueries({ queryKey: ["backlog-ranking-unificado", userId, clienteId] }),
      ]);
      await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(false);
      setAviso(`Chamado ${resultado.numero} criado. Nenhuma OS ou tarefa Auvo foi criada.`);
    } catch { setAviso("Não foi possível confirmar a promoção. A tentativa permanece guardada; repita somente o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (trava.current || pendente || recuperacao.invalido || !consultaDisponivel || estado !== "aguardando" || !confirmacao || revisaoConfirmada !== revisao) return;
    try {
      const pedido = pedidoSchema.parse({ requestId: crypto.randomUUID(), atorId: userId, clienteId, retornoId, retornoRevision: revisao,
        chamadoId: crypto.randomUUID(), parcelaId: crypto.randomUUID(), cicloId: crypto.randomUUID(), titulo, descricao });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(pedido)); setPendente(pedido); void enviar(pedido);
    } catch { setAviso("Não foi possível guardar a tentativa. Confira o título e a sessão."); }
  }
  return <section aria-label="Promoção de retorno" className="mt-2 rounded-md border border-line p-3">
    <p>Cria um Chamado e parcela para este retorno, sem OS ou tarefa. Não comprova que a execução anterior parou.</p>
    {recuperacao.invalido ? <p role="alert">Tentativa local inválida. Procure suporte antes de registrar outra.</p> : pendente ? <>
      <p>Pedido pendente para a revisão {pendente.retornoRevision}; a resposta pode ter sido perdida.</p>
      <Button variant="secondary" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</Button>
    </> : estado !== "aguardando" ? <p>Este retorno não está disponível para nova promoção.</p> : <>
      <label>Título do Chamado <input className="input" maxLength={200} value={titulo} disabled={ocupado || !consultaDisponivel} onChange={(e) => { setTitulo(e.target.value); setConfirmacao(false); }} /></label>
      <label>Descrição <textarea className="input" maxLength={10000} value={descricao} disabled={ocupado || !consultaDisponivel} onChange={(e) => { setDescricao(e.target.value); setConfirmacao(false); }} /></label>
      {confirmacao && revisaoConfirmada !== revisao && <p role="alert">A revisão mudou. Confira o retorno e confirme novamente.</p>}
      <label><input type="checkbox" checked={confirmacao && revisaoConfirmada === revisao} disabled={ocupado || !consultaDisponivel} onChange={(e) => { setConfirmacao(e.target.checked); setRevisaoConfirmada(e.target.checked ? revisao : null); }} /> Confirmo o retorno e a revisão {revisao} para novo Chamado.</label>
      <Button variant="secondary" disabled={ocupado || !consultaDisponivel || !titulo.trim() || !confirmacao || revisaoConfirmada !== revisao} onClick={iniciar}>Criar Chamado do retorno</Button>
    </>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
