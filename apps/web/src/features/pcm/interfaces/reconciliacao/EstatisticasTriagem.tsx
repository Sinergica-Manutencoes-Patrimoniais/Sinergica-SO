import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const contagem = z.number().int().nonnegative();
const resultado = z.object({ limite: z.literal(1000), consideradas: contagem.max(1000), truncado: z.boolean(), pendenteObservado: contagem, processandoObservado: contagem, erroObservado: contagem, enviadoObservado: contagem, estadoRemoto: z.literal("desconhecido") }).strict();
export function EstatisticasTriagem({ userId, clienteId }: { userId: string; clienteId: string }) {
  const consulta = useQuery({ queryKey: ["reconciliacao-estatisticas-triagem", userId, clienteId], gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_estatisticas_notas_triagem", { p_cliente_id: clienteId }).abortSignal(signal); if (error) throw error; return resultado.parse(data); } });
  return <section aria-label="Estatísticas de triagem"><h3>Anotações de triagem</h3><p>São estados observados nas notas, não diagnóstico ou confirmação remota.</p>
    {consulta.isFetching && <output>Consultando estatísticas...</output>}{consulta.isError && <p role="alert">Estatísticas indisponíveis ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <><p>{consulta.data.pendenteObservado} pendente · {consulta.data.processandoObservado} processando · {consulta.data.erroObservado} erro · {consulta.data.enviadoObservado} enviado observado.</p><p>{consulta.data.truncado ? `Amostra truncada em ${consulta.data.limite} notas; não é o total.` : `${consulta.data.consideradas} notas consideradas no escopo autorizado.`}</p></>}
  </section>;
}
