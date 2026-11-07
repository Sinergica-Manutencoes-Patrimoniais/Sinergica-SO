import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().guid();
const snapshot = z.object({
  geracao: z.string().regex(/^\d+$/),
  epoca: uuid,
  ordens: z.array(z.object({ vinculoId: uuid, osId: uuid, sequencia: z.number().int(), estimativaMinutos: z.number().int().nullable(), status: z.string(), excluidaEm: z.string().nullable() }).strict()).max(100),
  equipe: z.array(z.object({ vinculoId: uuid, funcionarioId: uuid, papel: z.string(), estimativaMinutos: z.number().int().nullable(), ativo: z.boolean(), excluidoEm: z.string().nullable() }).strict()).max(100),
}).strict();
const previa = z.object({ visitaId: uuid, revision: z.number().int(), estadoVisita: z.string(), snapshot, situacao: z.enum(["nao_conferida", "alterada", "equivalente"]), autorizaEnvio: z.literal(false) }).strict();
const resposta = z.object({ requestId: uuid, visitaId: uuid, revision: z.number().int(), state: z.literal("composicao_conferida_sem_envio") }).strict();
type Pedido = { requestId: string; revision: number; snapshot: z.infer<typeof snapshot> };

export function ConferirComposicao({ userId, clienteId, visitaId, bloqueado }: { userId: string; clienteId: string; visitaId: string; bloqueado: boolean }) {
  const queryClient = useQueryClient();
  const chave = ["visita-composicao", userId, clienteId, visitaId] as const;
  const storageKey = `visita-composicao:${userId}:${clienteId}:${visitaId}`;
  const [aceito, setAceito] = useState(false);
  const ocupado = useRef(false);
  const consulta = useQuery({ queryKey: chave, gcTime: 0, staleTime: 0, retry: false, queryFn: async ({ signal }) => {
    const { data, error } = await supabase.schema("pcm").rpc("sso_previa_composicao_visita", { p_cliente_id: clienteId, p_visita_id: visitaId }).abortSignal(signal);
    if (error) throw error;
    const valor = previa.parse(data);
    if (valor.visitaId !== visitaId) throw new Error("Visita divergente");
    return valor;
  } });
  const comando = useMutation({ mutationFn: async (pedido: Pedido) => {
    const { data, error } = await supabase.schema("pcm").rpc("sso_conferir_composicao_visita", { p_request_id: pedido.requestId, p_cliente_id: clienteId, p_visita_id: visitaId, p_revisao: pedido.revision, p_snapshot: pedido.snapshot });
    if (error) throw error;
    const valor = resposta.parse(data);
    if (valor.requestId !== pedido.requestId || valor.visitaId !== visitaId || valor.revision !== pedido.revision) throw new Error("Resposta divergente");
  } });
  const registrar = async () => {
    if (ocupado.current || bloqueado || consulta.isFetching || consulta.isError || !consulta.data || !aceito || consulta.data.estadoVisita !== "planejada") return;
    ocupado.current = true;
    try {
      let pedido: Pedido;
      const anterior = sessionStorage.getItem(storageKey);
      if (anterior) {
        pedido = z.object({ requestId: uuid, revision: z.number().int(), snapshot }).strict().parse(JSON.parse(anterior));
      } else {
        pedido = { requestId: crypto.randomUUID(), revision: consulta.data.revision, snapshot: consulta.data.snapshot };
        sessionStorage.setItem(storageKey, JSON.stringify(pedido));
      }
      await comando.mutateAsync(pedido);
      sessionStorage.removeItem(storageKey);
      setAceito(false);
      await queryClient.invalidateQueries({ queryKey: chave });
    } catch { /* Preserva o pedido para recuperação idempotente. */ }
    finally { ocupado.current = false; }
  };
  const dados = consulta.data;
  return <section aria-label="Conferência de composição da Visita" className="space-y-2 rounded border border-line p-3">
    <h3>Conferência da composição</h3>
    <p>Confira OS e equipe. Esta conferência não valida todo o conteúdo nem autoriza envio.</p>
    {consulta.isFetching && <output>Consultando composição...</output>}
    {consulta.isError && <p role="alert">Não foi possível consultar a composição. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {dados && !consulta.isFetching && !consulta.isError && <>
      <p>{dados.situacao === "equivalente" ? "Composição atual equivalente ao último registro." : dados.situacao === "alterada" ? "Composição mudou desde a conferência." : "Composição ainda não conferida."}</p>
      <p>Revisão {dados.revision} — {dados.estadoVisita}</p>
      <h4>Ordens de serviço</h4><ul>{dados.snapshot.ordens.map((o) => <li key={o.vinculoId}>OS {o.osId} — sequência {o.sequencia} — {o.status}{o.excluidaEm ? " — excluída" : ""} — estimativa {o.estimativaMinutos ?? "não informada"} min</li>)}</ul>
      <h4>Equipe</h4><ul>{dados.snapshot.equipe.map((e) => <li key={e.vinculoId}>Pessoa {e.funcionarioId} — {e.papel}{!e.ativo || e.excluidoEm ? " — inativa ou excluída" : ""} — estimativa {e.estimativaMinutos ?? "não informada"} min</li>)}</ul>
      <label><input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} /> Conferi esta composição.</label>{" "}
      <button type="button" disabled={bloqueado || comando.isPending || !aceito || dados.estadoVisita !== "planejada" || !dados.snapshot.ordens.length || !dados.snapshot.equipe.length} onClick={() => void registrar()}>Registrar conferência</button>
      {comando.isError && <p role="alert">Não foi possível registrar. Uma nova tentativa recupera o mesmo pedido; confira a Visita antes de prosseguir.</p>}
    </>}
  </section>;
}
