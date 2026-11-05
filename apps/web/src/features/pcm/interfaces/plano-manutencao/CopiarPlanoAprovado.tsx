import { Button } from "@sinergica/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { planoManutencaoKeys } from "../../application/plano-manutencao-queries";

const uuid = z.string().uuid();
const pedidoSchema = z.object({
  requestId: uuid, atorId: uuid, clienteId: uuid, origemPlanoId: uuid,
  origemVersaoId: uuid, origemRevision: z.number().int().positive(),
  destinoPlanoId: uuid, destinoVersaoId: uuid, nome: z.string().trim().min(1).max(200),
}).strict().refine((v) => v.origemPlanoId !== v.destinoPlanoId);
type Pedido = z.infer<typeof pedidoSchema>;
const reciboSchema = z.object({
  requestId: uuid, planoId: uuid, versaoId: uuid, revision: z.literal(1),
  estado: z.literal("rascunho"), execucaoCriada: z.literal(false),
  questionariosRequeremConferencia: z.literal(true),
  rotinas: z.array(z.object({ origemRotinaId: uuid, origemLogicaId: uuid, rotinaId: uuid, rotinaLogicaId: uuid }).strict()).min(1).max(1000),
}).strict();

export function CopiarPlanoAprovado({ userId, clienteId, planoId, planoNome, revisao, versaoId, versaoNumero }: {
  userId: string; clienteId: string; planoId: string; planoNome: string; revisao: number; versaoId: string; versaoNumero: number;
}) {
  const chave = `sso-copia-plano:${userId}:${clienteId}:${planoId}`;
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return { pedido: null, invalido: false };
      const pedido = pedidoSchema.parse(JSON.parse(salvo));
      if (pedido.atorId !== userId || pedido.clienteId !== clienteId || pedido.origemPlanoId !== planoId) throw new Error("Contexto divergente");
      return { pedido, invalido: false };
    } catch { return { pedido: null, invalido: true }; }
  });
  const [pendente, setPendente] = useState<Pedido | null>(recuperacao.pedido);
  const [nome, setNome] = useState(`${planoNome} — cópia`.slice(0, 200));
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const trava = useRef(false);
  const queryClient = useQueryClient();

  async function conferirAtor() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId) throw new Error("Sessão alterada");
  }
  async function enviar(pedido: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setMensagem("");
    const serializado = JSON.stringify(pedido);
    try {
      await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa local alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_copiar_plano_mediado", {
        p_request_id: pedido.requestId, p_cliente_id: pedido.clienteId,
        p_origem_plano_id: pedido.origemPlanoId, p_origem_versao_id: pedido.origemVersaoId,
        p_origem_revision: pedido.origemRevision, p_destino_plano_id: pedido.destinoPlanoId,
        p_destino_versao_id: pedido.destinoVersaoId, p_nome: pedido.nome, p_ator_esperado: pedido.atorId,
      });
      if (error) throw error;
      const recibo = reciboSchema.parse(data);
      if (recibo.requestId !== pedido.requestId || recibo.planoId !== pedido.destinoPlanoId || recibo.versaoId !== pedido.destinoVersaoId) throw new Error("Recibo divergente");
      for (const campo of ["origemRotinaId", "origemLogicaId", "rotinaId", "rotinaLogicaId"] as const) {
        if (new Set(recibo.rotinas.map((r) => r[campo])).size !== recibo.rotinas.length) throw new Error("Recibo duplicado");
      }
      if (recibo.rotinas.some((r) => r.origemRotinaId === r.rotinaId || r.origemLogicaId === r.rotinaLogicaId)) throw new Error("Identidades não renovadas");
      await conferirAtor();
      await queryClient.invalidateQueries({ queryKey: planoManutencaoKeys.raiz(userId, clienteId) });
      await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa local alterada");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmar(false);
      setMensagem(`Rascunho criado (${recibo.planoId}). Confira os questionários antes de aprovar. Nenhuma execução foi criada.`);
    } catch {
      setMensagem("Não foi possível confirmar a cópia. A tentativa permanece guardada; repita somente o mesmo pedido ou procure suporte para reconciliação.");
    } finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (trava.current || pendente || recuperacao.invalido) return;
    try {
      const pedido = pedidoSchema.parse({ requestId: crypto.randomUUID(), atorId: userId, clienteId,
        origemPlanoId: planoId, origemVersaoId: versaoId, origemRevision: revisao,
        destinoPlanoId: crypto.randomUUID(), destinoVersaoId: crypto.randomUUID(), nome });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(pedido));
      setPendente(pedido); void enviar(pedido);
    } catch { setMensagem("Não foi possível guardar a tentativa. Confira o nome e a sessão antes de continuar."); }
  }
  return <div className="mt-3 rounded-md border border-line p-3">
    <h4 className="font-semibold">Copiar versão aprovada</h4>
    <p>Cria um Plano em rascunho para o mesmo Cliente, sem gerar ocorrências ou OS. Os questionários precisam de conferência.</p>
    {recuperacao.invalido ? <p role="alert">Tentativa guardada inválida ou inacessível. Procure suporte para reconciliação; não crie outra cópia.</p> : pendente ? <>
      <p>Pedido pendente: {pendente.nome}, versão {pendente.origemVersaoId}. A resposta pode ter sido perdida.</p>
      <Button variant="secondary" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</Button>
    </> : <>
      <label>Nome do novo Plano <input className="input" maxLength={200} value={nome} disabled={ocupado} onChange={(e) => { setNome(e.target.value); setConfirmar(false); }} /></label>
      <p>Origem: versão {versaoNumero}, revisão {revisao}.</p>
      <label><input type="checkbox" checked={confirmar} disabled={ocupado} onChange={(e) => setConfirmar(e.target.checked)} /> Confirmo a criação do rascunho para este Cliente.</label>
      <Button variant="secondary" disabled={!confirmar || ocupado || !nome.trim()} onClick={iniciar}>Criar cópia em rascunho</Button>
    </>}
    {mensagem && <p role="status">{mensagem}</p>}
  </div>;
}
