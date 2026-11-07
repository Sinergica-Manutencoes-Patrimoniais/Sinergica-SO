import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const resultado = z.object({ outboxId: z.string().guid(), contextoEquivalente: z.boolean(), revisaoMonotonicaDisponivel: z.literal(false), situacaoRemota: z.literal("desconhecida"), autorizaRetry: z.literal(false) }).strict();
export function RevalidarPreviaFila({ userId, clienteId, outboxId, estado, tentativas }: { userId: string; clienteId: string; outboxId: string; estado: string; tentativas: number }) {
  const consulta = useQuery({ queryKey: ["reconciliacao-revalidar-previa", userId, clienteId, outboxId, estado, tentativas], gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_revalidar_previa_fila", { p_cliente_id: clienteId, p_outbox_id: outboxId, p_estado: estado, p_tentativas: tentativas }).abortSignal(signal); if (error) throw error; const r = resultado.parse(data); if (r.outboxId !== outboxId) throw new Error("Item divergente"); return r; } });
  return <section aria-label="Revalidação da prévia"><h4>Revalidação da prévia</h4>
    <p>Não há revisão monotônica disponível: a comparação não identifica alterações revertidas. Estado remoto desconhecido; não autoriza retentativa.</p>
    {consulta.isFetching && <output>Revalidando contexto...</output>}{consulta.isError && <p role="alert">Não foi possível revalidar contexto ou acesso. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <p>{consulta.data.contextoEquivalente ? "Estado e tentativas atuais equivalem à prévia; isso não comprova ausência de outras mudanças." : "Estado ou tentativas mudaram desde a prévia."}</p>}
  </section>;
}
