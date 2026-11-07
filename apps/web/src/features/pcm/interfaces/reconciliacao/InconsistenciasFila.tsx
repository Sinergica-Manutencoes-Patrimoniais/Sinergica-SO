import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const resultado = z.object({ considerados: z.number().int().nonnegative().max(1000), limite: z.literal(1000), truncado: z.boolean(), inconsistencias: z.number().int().nonnegative(), linhasSemClienteComprovado: z.literal("nao_avaliadas"), estadoRemoto: z.literal("desconhecido"), autorizaRetry: z.literal(false) }).strict();
export function InconsistenciasFila({ userId, clienteId }: { userId: string; clienteId: string }) {
  const consulta = useQuery({ queryKey: ["reconciliacao-inconsistencias-fila", userId, clienteId], gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_diagnostico_inconsistencias_fila", { p_cliente_id: clienteId }).abortSignal(signal); if (error) throw error; return resultado.parse(data); } });
  return <section aria-label="Inconsistências locais da fila"><h3>Inconsistências locais</h3><p>Somente itens com Cliente comprovado. Linhas sem Cliente comprovado não foram avaliadas; estado remoto permanece desconhecido.</p>
    {consulta.isFetching && <output>Consultando dados locais…</output>}{consulta.isError && <p role="alert">Não foi possível verificar inconsistências; o resultado não é uma fila vazia. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar dados locais</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <p>{consulta.data.inconsistencias} inconsistência(s) em {consulta.data.considerados} itens examinados. {consulta.data.truncado ? "Amostra truncada; não representa o total." : "Nenhuma conclusão sobre linhas fora deste escopo."}</p>}
  </section>;
}
