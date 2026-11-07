import { Button } from "@sinergica/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import type { CandidatoDevolucao } from "./CandidatosDevolucaoCiclo";

const id = z.string().guid();
const base = { requestId: id, atorId: id, clienteId: id, composicaoId: id, pendenciaId: id };
const pedidoSchema = z.discriminatedUnion("tipo", [
  z.object({ ...base, tipo: z.literal("inicializar"), cicloId: id }).strict(),
  z.object({ ...base, tipo: z.literal("devolver"), cicloId: id, retornoId: id, cicloRevision: z.number().int().positive(),
    suspensaoRevision: z.number().int().positive(), interrupcaoRevision: z.number().int().positive(), reconciliacaoId: id,
    motivo: z.string().trim().min(1).max(2000) }).strict(),
]);
type Pedido = z.infer<typeof pedidoSchema>;
const inicializacaoSchema = z.object({ requestId: id, cicloId: id, estadoInicial: z.literal("em_tratamento"), devolvido: z.literal(false) }).strict();
const devolucaoSchema = z.object({ requestId: id, cicloId: id, retornoId: id, revision: z.number().int().positive(), estado: z.literal("aguardando") }).strict();

export function ComandosCicloDevolucao({ userId, clienteId, composicaoId, candidato, disponivel }: {
  userId: string; clienteId: string; composicaoId: string; candidato: CandidatoDevolucao; disponivel: boolean;
}) {
  const chave = `sso-ciclo-devolucao:${userId}:${clienteId}:${composicaoId}:${candidato.pendencia_id}`;
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave); if (!salvo) return { pedido: null, invalido: false };
      const pedido = pedidoSchema.parse(JSON.parse(salvo));
      if (pedido.atorId !== userId || pedido.clienteId !== clienteId || pedido.composicaoId !== composicaoId || pedido.pendenciaId !== candidato.pendencia_id) throw new Error("Contexto divergente");
      return { pedido, invalido: false };
    } catch { return { pedido: null, invalido: true }; }
  });
  const [pendente, setPendente] = useState<Pedido | null>(recuperacao.pedido);
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [recusaConfirmada, setRecusaConfirmada] = useState<string | null>(null);
  const [confirmarEncerramento, setConfirmarEncerramento] = useState(false);
  const trava = useRef(false);
  const cache = useQueryClient();
  const fotografia = JSON.stringify(candidato);
  const podeInicializar = candidato.situacao === "pendente" && !candidato.ciclo_id;
  const podeDevolver = candidato.situacao === "pendente" && candidato.ciclo_estado === "em_tratamento" && candidato.ciclo_id && candidato.ciclo_revisao
    && candidato.suspensao_estado === "suspenso" && candidato.suspensao_revisao && candidato.os_id
    && (candidato.os_status === "finalizado" || candidato.os_status === "cancelado") && candidato.interrupcao_estado === "declarada"
    && candidato.interrupcao_revisao && candidato.reconciliacao_id && candidato.reconciliacao_estado === "nao_executada_declarada"
    && candidato.reconciliacao_suspensao_revisao === candidato.suspensao_revisao && candidato.reconciliacao_interrupcao_revisao === candidato.interrupcao_revisao;
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada"); }
  async function enviar(pedido: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setAviso(""); setRecusaConfirmada(null); setConfirmarEncerramento(false);
    const serializado = JSON.stringify(pedido);
    try {
      await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const resposta = pedido.tipo === "inicializar"
        ? await supabase.schema("pcm").rpc("sso_inicializar_ciclo_backlog_ator", { p_request_id: pedido.requestId, p_ator_esperado: pedido.atorId,
          p_cliente_id: pedido.clienteId, p_pendencia_id: pedido.pendenciaId, p_ciclo_id: pedido.cicloId })
        : await supabase.schema("pcm").rpc("sso_devolver_ciclo_backlog_ator", { p_request_id: pedido.requestId, p_ator_esperado: pedido.atorId,
          p_cliente_id: pedido.clienteId, p_ciclo_id: pedido.cicloId, p_retorno_id: pedido.retornoId, p_ciclo_revision: pedido.cicloRevision,
          p_suspensao_revision: pedido.suspensaoRevision, p_interrupcao_revision: pedido.interrupcaoRevision, p_reconciliacao_id: pedido.reconciliacaoId, p_motivo: pedido.motivo });
      if (resposta.error) {
        if (pedido.tipo === "devolver" && resposta.error.code === "23514" && resposta.error.message === "continuidade_exige_conferencia_retorno_parcial") {
          await conferirAtor();
          if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
          setRecusaConfirmada(serializado);
          setAviso("O servidor recusou a devolução integral porque existe continuidade vinculada. Confira o retorno parcial.");
          return;
        }
        throw resposta.error;
      }
      if (pedido.tipo === "inicializar") {
        const r = inicializacaoSchema.parse(resposta.data);
        if (r.requestId !== pedido.requestId || r.cicloId !== pedido.cicloId) throw new Error("Recibo divergente");
      } else {
        const r = devolucaoSchema.parse(resposta.data);
        if (r.requestId !== pedido.requestId || r.cicloId !== pedido.cicloId || r.retornoId !== pedido.retornoId || r.revision !== pedido.cicloRevision + 1) throw new Error("Recibo divergente");
      }
      await conferirAtor();
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["backlog-candidatos-ciclo", userId, clienteId, composicaoId] }),
        cache.invalidateQueries({ queryKey: ["backlog-ciclos-posteriores", userId, clienteId, composicaoId] }),
        cache.invalidateQueries({ queryKey: ["backlog-retornos-ciclo", userId, clienteId] }),
        cache.invalidateQueries({ queryKey: ["backlog-ranking-unificado", userId, clienteId] }),
      ]);
      await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setMotivo("");
      setAviso(pedido.tipo === "inicializar" ? "Ciclo inicializado; nenhuma parcela foi devolvida." : "Retorno registrado; nenhuma OS ou tarefa foi criada.");
    } catch { setAviso("Não foi possível confirmar a operação. A tentativa permanece guardada; repita somente o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function encerrarTentativaRecusada() {
    if (trava.current || !pendente || !recusaConfirmada || !confirmarEncerramento || JSON.stringify(pendente) !== recusaConfirmada) return;
    trava.current = true; setOcupado(true);
    try {
      await conferirAtor();
      if (sessionStorage.getItem(chave) !== recusaConfirmada) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setRecusaConfirmada(null); setConfirmarEncerramento(false); setConfirmacao(null);
      setAviso("Tentativa recusada encerrada nesta aba. Confira a continuidade antes de outra operação.");
    } catch { setAviso("Não foi possível confirmar a sessão ou a tentativa. O pedido continua guardado."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar(tipo: Pedido["tipo"]) {
    if (trava.current || pendente || recuperacao.invalido || !disponivel || confirmacao !== `${tipo}:${fotografia}`) return;
    try {
      const comum = { requestId: crypto.randomUUID(), atorId: userId, clienteId, composicaoId, pendenciaId: candidato.pendencia_id };
      const pedido = tipo === "inicializar" && podeInicializar
        ? pedidoSchema.parse({ ...comum, tipo, cicloId: crypto.randomUUID() })
        : tipo === "devolver" && podeDevolver
          ? pedidoSchema.parse({ ...comum, tipo, cicloId: candidato.ciclo_id, retornoId: crypto.randomUUID(), cicloRevision: candidato.ciclo_revisao,
            suspensaoRevision: candidato.suspensao_revisao, interrupcaoRevision: candidato.interrupcao_revisao, reconciliacaoId: candidato.reconciliacao_id, motivo })
          : null;
      if (!pedido || sessionStorage.getItem(chave) !== null) throw new Error("Tentativa inválida ou existente");
      sessionStorage.setItem(chave, JSON.stringify(pedido)); setPendente(pedido); void enviar(pedido);
    } catch { setAviso("Não foi possível guardar a tentativa. Confira os dados, motivo e sessão."); }
  }
  const tipo = podeInicializar ? "inicializar" : podeDevolver ? "devolver" : null;
  return <section aria-label="Comandos de ciclo" className="mt-2 rounded-md border border-line p-3">
    <p>Os sinais são declarações administrativas e não comprovam a parada da execução anterior.</p>
    {recuperacao.invalido ? <p role="alert">Tentativa local inválida. Procure suporte antes de iniciar outra.</p> : pendente ? <>
      <p>Há uma tentativa de {pendente.tipo} pendente; a resposta pode ter sido perdida.</p><Button variant="secondary" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</Button>
      {recusaConfirmada && <><label><input type="checkbox" checked={confirmarEncerramento} disabled={ocupado} onChange={(e) => setConfirmarEncerramento(e.target.checked)} /> Confirmo encerrar nesta aba a tentativa recusada pelo servidor.</label>
        <Button variant="secondary" disabled={ocupado || !confirmarEncerramento} onClick={() => void encerrarTentativaRecusada()}>Encerrar tentativa recusada</Button></>}
    </> : tipo ? <>
      {tipo === "devolver" && <label>Motivo <textarea className="input" maxLength={2000} value={motivo} disabled={ocupado || !disponivel} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>}
      {confirmacao && confirmacao !== `${tipo}:${fotografia}` && <p role="alert">Os sinais mudaram. Confira novamente antes de confirmar.</p>}
      <label><input type="checkbox" checked={confirmacao === `${tipo}:${fotografia}`} disabled={ocupado || !disponivel} onChange={(e) => setConfirmacao(e.target.checked ? `${tipo}:${fotografia}` : null)} /> Confirmo {tipo === "inicializar" ? "a inicialização do ciclo sem devolver escopo" : "a devolução declarada deste ciclo"}.</label>
      <Button variant="secondary" disabled={ocupado || !disponivel || confirmacao !== `${tipo}:${fotografia}` || (tipo === "devolver" && !motivo.trim())} onClick={() => iniciar(tipo)}>{tipo === "inicializar" ? "Inicializar ciclo" : "Registrar devolução"}</Button>
    </> : <p>Não há comando disponível para os sinais carregados.</p>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
