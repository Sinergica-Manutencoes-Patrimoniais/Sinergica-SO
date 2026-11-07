import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const resultado = z.object({ estado: z.enum(["solicitacao", "corretiva", "backlog", "planejamento", "em_execucao", "finalizado", "cancelado", "desconhecido"]), aprovacao_retorno_registrada: z.boolean() }).strict();
const rotulos: Record<z.infer<typeof resultado>["estado"], string> = {
  solicitacao: "Solicitação", corretiva: "Corretiva", backlog: "Em espera", planejamento: "Em planejamento",
  em_execucao: "Em execução", finalizado: "Marcada finalizada", cancelado: "Cancelada", desconhecido: "Não informada",
};
export function SituacaoOsPortal({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  const consulta = useQuery({ queryKey: ["portal-situacao-os", userId, clienteId, osId], gcTime: 0, staleTime: 0, retry: false,
    refetchOnWindowFocus: true, queryFn: async ({ signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_portal_situacao_os", { p_cliente_id: clienteId, p_os_id: osId }).abortSignal(signal);
      if (error) throw error; return z.array(resultado).length(1).parse(data)[0]!;
    } });
  if (consulta.isPending || consulta.isFetching) return <span>Consultando situação…</span>;
  if (consulta.isError) return <span role="alert">Situação indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></span>;
  return <div><p>Situação operacional: {rotulos[consulta.data.estado]}.</p>
    <p>{consulta.data.aprovacao_retorno_registrada ? "Há aprovação PCM registrada para um retorno; isso não comprova a validação integral da OS." : "Não há aprovação PCM de retorno comprovada nesta consulta."}</p>
    <p>A marcação de finalização, isoladamente, não significa validação pelo PCM.</p></div>;
}
