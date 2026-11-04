import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const resultado = z.object({ consideradas: z.number().int().nonnegative().max(1000), limite: z.literal(1000), truncado: z.boolean(), gruposCoincidentes: z.number().int().nonnegative(), linhasCoincidentes: z.number().int().nonnegative(), provaDuplicidade: z.literal(false), estadoRemoto: z.literal("desconhecido") }).strict();
export function CoincidenciasFila({ userId, clienteId }: { userId: string; clienteId: string }) {
  const consulta = useQuery({ queryKey: ["reconciliacao-coincidencias-fila", userId, clienteId], gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_inventario_coincidencias_fila", { p_cliente_id: clienteId }).abortSignal(signal); if (error) throw error; return resultado.parse(data); } });
  return <section aria-label="Coincidências locais da fila"><h3>Coincidências locais</h3><p>Mesmo objeto e operação podem representar alterações legítimas. Coincidência não prova duplicidade nem estado remoto; nada é bloqueado ou removido.</p>
    {consulta.isFetching && <output>Consultando amostra...</output>}{consulta.isError && <p role="alert">Não foi possível consultar coincidências. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <p>{consulta.data.gruposCoincidentes} grupos e {consulta.data.linhasCoincidentes} linhas coincidentes em {consulta.data.consideradas} itens. {consulta.data.truncado ? "Amostra truncada; não representa o total." : "A análise se limita ao escopo autorizado."}</p>}
  </section>;
}
