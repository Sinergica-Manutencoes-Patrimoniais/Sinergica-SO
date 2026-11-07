import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const resultado = z.object({ outboxId: z.string().guid(), acoesLocais: z.array(z.enum(["consultar_historico", "registrar_anotacao"])), acoesBloqueadas: z.array(z.enum(["retry_externo", "confirmar_vinculo_remoto", "resolver_integracao"])), situacaoRemota: z.literal("desconhecida"), revalidarNaExecucao: z.literal(true) }).strict();
export function AcoesLocaisFila({ userId, clienteId, outboxId }: { userId: string; clienteId: string; outboxId: string }) {
  const consulta = useQuery({ queryKey: ["reconciliacao-acoes-locais", userId, clienteId, outboxId], gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_acoes_locais_fila", { p_cliente_id: clienteId, p_outbox_id: outboxId }).abortSignal(signal);
      if (error) throw error;
      const r = resultado.parse(data);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted || r.outboxId !== outboxId) throw new Error("Sessão ou item divergente.");
      return r;
    } });
  return <section aria-label="Ações locais da fila"><h4>Ações locais</h4><p>A autorização e o estado são revalidados ao executar; disponibilidade pode mudar.</p>
    {consulta.isFetching && <output>Consultando ações...</output>}{consulta.isError && <p role="alert">Ações indisponíveis ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <><p>Disponíveis nesta triagem: {consulta.data.acoesLocais.includes("consultar_historico") ? "consultar histórico" : ""}{consulta.data.acoesLocais.includes("registrar_anotacao") ? " e registrar anotação" : ""}.</p><p>Retentativa externa, confirmação de vínculo remoto e resolução continuam bloqueadas; estado remoto desconhecido.</p></>}
  </section>;
}
