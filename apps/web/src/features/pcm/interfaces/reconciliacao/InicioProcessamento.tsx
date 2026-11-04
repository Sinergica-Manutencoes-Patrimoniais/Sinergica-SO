import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const resposta = z.object({ outboxId: z.string().uuid(), estadoFila: z.enum(["pending", "processing", "error", "sent"]),
  processamentoIniciadoEm: z.string().datetime({ offset: true }).nullable(), observadoEm: z.string().datetime({ offset: true }),
  estadoRemoto: z.literal("desconhecido"), autorizaRetry: z.literal(false) }).strict();

export function InicioProcessamento({ userId, clienteId, outboxId }: { userId: string; clienteId: string; outboxId: string }) {
  const consulta = useQuery({
    queryKey: ["reconciliacao-inicio-processamento", userId, clienteId, outboxId], gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_inicio_processamento", {
        p_ator_id: userId, p_cliente_id: clienteId, p_outbox_id: outboxId,
      }).abortSignal(signal);
      if (error) throw error;
      const r = resposta.parse(data); if (r.outboxId !== outboxId) throw new Error("Item divergente");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      return r;
    },
  });
  return <section aria-label="Início de processamento da fila">
    <h5>Início observado</h5>
    <p>O horário não comprova falha ou ausência de efeito remoto e não autoriza retentativa.</p>
    {consulta.isFetching && <p role="status">Consultando início…</p>}
    {consulta.isError && <p role="alert">Início indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <p>Estado: {consulta.data.estadoFila} · início: {consulta.data.processamentoIniciadoEm ?? "desconhecido ou não está processando"} · consulta: {consulta.data.observadoEm}.</p>}
  </section>;
}
