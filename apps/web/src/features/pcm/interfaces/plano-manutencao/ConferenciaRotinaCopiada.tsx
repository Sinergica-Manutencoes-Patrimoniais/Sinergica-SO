import { Button } from "@sinergica/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const contexto = { clienteId: id, planoId: id, versaoId: id, rotinaId: id };
const consultaSchema = z.union([
  z.object({ ...contexto, copiada: z.literal(false) }).strict(),
  z.object({ ...contexto, copiada: z.literal(true), planoRevision: z.number().int().positive(), conteudoSha256: hash,
    conferenciaAtual: z.boolean(), questionarioProjetadoParcialmente: z.literal(true),
    comparacaoQuestionario: z.enum(["origem_restrita", "historico_indeterminado", "sem_questionario", "referencia_alterada", "conteudo_integral_igual", "conteudo_integral_diferente"]),
    questionarioAtual: z.object({ id, nome: z.string().max(1000), cabecalho: z.string().max(10000).nullable(),
      rodape: z.string().max(10000).nullable(), perguntas: z.array(z.string().max(4000).nullable()).max(500) }).strict().nullable(),
    aprovacaoRealizada: z.literal(false) }).strict(),
]);
const pedidoSchema = z.object({ requestId: id, atorId: id, ...contexto, planoRevision: z.number().int().positive(),
  conteudoSha256: hash, justificativa: z.string().trim().min(1).max(2000) }).strict();
const reciboSchema = z.object({ requestId: id, ...contexto, planoRevision: z.number().int().positive(), conteudoSha256: hash,
  declaracaoRegistrada: z.literal(true), aprovacaoRealizada: z.literal(false) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const comparacoes = {
  origem_restrita: "Comparação indisponível: você não tem acesso à origem.",
  historico_indeterminado: "Comparação indeterminada: fotografia histórica indisponível ou incompleta.",
  sem_questionario: "Nenhuma referência de questionário na origem ou no rascunho.",
  referencia_alterada: "A referência de questionário é diferente da origem; conteúdo não comparado.",
  conteudo_integral_igual: "Cadastro atual igual à fotografia histórica neste instante, incluindo metadados.",
  conteudo_integral_diferente: "Cadastro atual diferente da fotografia histórica; a diferença pode incluir metadados.",
} as const;

export function ConferenciaRotinaCopiada({ userId, clienteId, planoId, versaoId, rotinaId, revisao }: {
  userId: string; clienteId: string; planoId: string; versaoId: string; rotinaId: string; revisao: number;
}) {
  const chave = `sso-conferencia-rotina-copiada:${userId}:${clienteId}:${planoId}:${versaoId}:${rotinaId}`;
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave); if (!salvo) return { pedido: null, invalido: false };
      const pedido = pedidoSchema.parse(JSON.parse(salvo));
      if (pedido.atorId !== userId || pedido.clienteId !== clienteId || pedido.planoId !== planoId || pedido.versaoId !== versaoId || pedido.rotinaId !== rotinaId) throw new Error("Contexto divergente");
      return { pedido, invalido: false };
    } catch { return { pedido: null, invalido: true }; }
  });
  const [pendente, setPendente] = useState<Pedido | null>(recuperacao.pedido);
  const [justificativa, setJustificativa] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const trava = useRef(false);
  const cache = useQueryClient();
  const chaveConsulta = ["conferencia-rotina-copiada", userId, clienteId, planoId, versaoId, rotinaId] as const;
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada"); }
  const consulta = useQuery({
    queryKey: chaveConsulta, gcTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      await conferirAtor();
      const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_conferencia_copia", {
        p_cliente_id: clienteId, p_plano_id: planoId, p_versao_id: versaoId, p_rotina_id: rotinaId,
      }).abortSignal(signal);
      if (error) throw error;
      const resultado = consultaSchema.parse(data);
      if (resultado.clienteId !== clienteId || resultado.planoId !== planoId || resultado.versaoId !== versaoId || resultado.rotinaId !== rotinaId) throw new Error("Contexto divergente");
      await conferirAtor(); return resultado;
    },
  });
  const disponivel = !consulta.isFetching && !consulta.isError && consulta.data?.copiada === true && consulta.data.planoRevision === revisao;
  const assinaturaConferencia = disponivel ? JSON.stringify([consulta.data, justificativa]) : null;
  const confirmado = assinaturaConferencia !== null && confirmacao === assinaturaConferencia;
  async function enviar(pedido: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setAviso("");
    const serializado = JSON.stringify(pedido);
    try {
      await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_conferir_rotina_copiada", {
        p_request_id: pedido.requestId, p_ator_esperado: pedido.atorId, p_cliente_id: pedido.clienteId, p_plano_id: pedido.planoId,
        p_versao_id: pedido.versaoId, p_rotina_id: pedido.rotinaId, p_plano_revision: pedido.planoRevision,
        p_conteudo_sha256: pedido.conteudoSha256, p_justificativa: pedido.justificativa,
      });
      if (error) throw error;
      const resultado = reciboSchema.parse(data);
      if (resultado.requestId !== pedido.requestId || resultado.clienteId !== clienteId || resultado.planoId !== planoId || resultado.versaoId !== versaoId || resultado.rotinaId !== rotinaId || resultado.planoRevision !== pedido.planoRevision || resultado.conteudoSha256 !== pedido.conteudoSha256) throw new Error("Recibo divergente");
      await conferirAtor(); await cache.invalidateQueries({ queryKey: chaveConsulta }); await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setJustificativa("");
      setAviso("Conferência registrada. Ela não aprova o Plano nem substitui validação normativa.");
    } catch { setAviso("Não foi possível confirmar o registro. A tentativa permanece guardada; repita somente o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (trava.current || pendente || recuperacao.invalido || !disponivel || !consulta.data?.copiada || !confirmado) return;
    try {
      const pedido = pedidoSchema.parse({ requestId: crypto.randomUUID(), atorId: userId, clienteId, planoId, versaoId, rotinaId,
        planoRevision: consulta.data.planoRevision, conteudoSha256: consulta.data.conteudoSha256, justificativa });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(pedido)); setPendente(pedido); void enviar(pedido);
    } catch { setAviso("Não foi possível guardar a tentativa. Confira a justificativa e a sessão."); }
  }
  return <section aria-label="Conferência da Rotina copiada" className="mt-2 rounded-md border border-line p-3">
    <h5>Conferência da cópia</h5>
    {consulta.isFetching && <p role="status">Consultando estado atual...</p>}
    {consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {recuperacao.invalido && <p role="alert">Tentativa guardada inválida. Procure suporte antes de registrar outra.</p>}
    {pendente ? <><p>Há uma tentativa pendente para a revisão {pendente.planoRevision}. A resposta pode ter sido perdida.</p><Button variant="secondary" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</Button></> : !consulta.isFetching && !consulta.isError && consulta.data && <>
      {!consulta.data.copiada ? <p>Não há cópia identificada neste fluxo.</p> : consulta.data.planoRevision !== revisao ? <p role="alert">A revisão mudou. Recarregue o Plano antes de conferir.</p> : <>
        <p>{consulta.data.conferenciaAtual ? "Há declaração para a revisão e conteúdo atuais." : "Conferência atual pendente."} Alterações posteriores exigem nova conferência.</p>
        <p>Examine a Rotina, alvo, data-base, tolerâncias, questionário completo e exigências aplicáveis antes de declarar. Esta tela não substitui essa análise.</p>
        <p>{comparacoes[consulta.data.comparacaoQuestionario]} A comparação não valida o conteúdo nem aprova o Plano.</p>
        {consulta.data.questionarioAtual ? <div><strong>Questionário atual: {consulta.data.questionarioAtual.nome}</strong>
          {consulta.data.questionarioAtual.cabecalho && <p>{consulta.data.questionarioAtual.cabecalho}</p>}
          <ol>{consulta.data.questionarioAtual.perguntas.map((texto, indice) => <li key={`${indice}:${texto ?? "desconhecida"}`}>{texto ?? "Conteúdo não reconhecido; consultar a fonte."}</li>)}</ol>
          {consulta.data.questionarioAtual.rodape && <p>{consulta.data.questionarioAtual.rodape}</p>}
          <p>Esta é uma projeção parcial: campos, opções e estruturas não reconhecidas não são exibidos. Consulte também a fonte completa; o conteúdo atual pode divergir da versão histórica.</p>
        </div> : <p>Nenhum questionário está vinculado à Rotina atual.</p>}
        <label>Justificativa <textarea className="input" maxLength={2000} value={justificativa} disabled={ocupado || recuperacao.invalido} onChange={(e) => { setJustificativa(e.target.value); setConfirmacao(null); }} /></label>
        <label><input type="checkbox" checked={confirmado} disabled={ocupado || recuperacao.invalido || !disponivel} onChange={(e) => setConfirmacao(e.target.checked ? assinaturaConferencia : null)} /> Declaro ter conferido os dados e o questionário atual para este destino.</label>
        <Button variant="secondary" disabled={!disponivel || !confirmado || !justificativa.trim() || ocupado || recuperacao.invalido} onClick={iniciar}>Registrar conferência</Button>
      </>}
    </>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
