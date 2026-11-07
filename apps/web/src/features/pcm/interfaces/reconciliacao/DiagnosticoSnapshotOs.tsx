import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const resultado = z.object({ osId: z.string().guid(), snapshotLocalEncontrado: z.boolean(), ultimaRecepcaoDeclarada: z.string().nullable(), autenticidade: z.literal("nao_comprovada"), situacaoRemota: z.literal("desconhecida"), autorizaRetry: z.literal(false) }).strict();
export function DiagnosticoSnapshotOs({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  const consulta = useQuery({ queryKey: ["reconciliacao-snapshot-os", userId, clienteId, osId], gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_diagnostico_snapshot_os", { p_cliente_id: clienteId, p_os_id: osId }).abortSignal(signal); if (error) throw error; const r = resultado.parse(data); if (r.osId !== osId) throw new Error("OS divergente"); return r; } });
  return <section aria-label="Snapshot local da OS"><h4>Snapshot local</h4>
    <p>A presença de snapshot não comprova autenticidade ou estado remoto. A ausência não comprova ausência no Auvo. Nenhuma retentativa é autorizada.</p>
    {consulta.isFetching && <output>Consultando registro local...</output>}
    {consulta.isError && <p role="alert">Consulta indisponível ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <p>{consulta.data.snapshotLocalEncontrado ? "Snapshot local encontrado para o vínculo atual." : "Nenhum snapshot local encontrado para o vínculo atual."} {consulta.data.ultimaRecepcaoDeclarada && `Última recepção registrada: ${consulta.data.ultimaRecepcaoDeclarada}.`}</p>}
  </section>;
}
