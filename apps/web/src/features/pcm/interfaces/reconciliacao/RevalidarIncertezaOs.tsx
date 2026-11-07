import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const resultado = z.object({
  osId: z.string().guid(), versaoLocal: z.string(), estadoLocal: z.string().nullable(), tarefaLocal: z.string().nullable(),
  situacaoLocal: z.enum(["sem_declaracao", "fonte_local_alterada", "fonte_local_equivalente"]),
  ultimaDeclaracao: z.object({ requestId: z.string().guid(), resultadoDeclarado: z.enum(["nenhum", "um", "multiplos", "desconhecido"]), declaradaEm: z.string() }).strict().nullable(),
  situacaoRemota: z.literal("desconhecida"), autorizaRetry: z.literal(false),
}).strict();
export function RevalidarIncertezaOs({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  const consulta = useQuery({
    queryKey: ["reconciliacao-os-revalidacao", userId, clienteId, osId], gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_revalidar_incerteza_os_local", { p_cliente_id: clienteId, p_os_id: osId }).abortSignal(signal);
      if (error) throw error;
      const valor = resultado.parse(data);
      if (valor.osId !== osId) throw new Error("OS divergente");
      return valor;
    },
  });
  return <section aria-label="Revalidação local da OS"><h4>Revalidação local</h4>
    <p>Situação remota desconhecida. Esta consulta não acessa o Auvo e não autoriza retentativa externa.</p>
    {consulta.isFetching && <output>Consultando fonte local...</output>}
    {consulta.isError && <p role="alert">Não foi possível consultar a fonte local. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <>
      <p>{consulta.data.situacaoLocal === "sem_declaracao" ? "Nenhuma declaração registrada." : consulta.data.situacaoLocal === "fonte_local_alterada" ? "A fonte local mudou após a declaração." : "A fonte local está equivalente à declaração; isso não comprova o estado remoto nem exclui alterações revertidas."}</p>
      <p>Estado local: {consulta.data.estadoLocal ?? "não informado"} · tarefa local: {consulta.data.tarefaLocal ?? "não identificada"} · versão local: {consulta.data.versaoLocal}</p>
      {consulta.data.ultimaDeclaracao && <p>Última declaração: {consulta.data.ultimaDeclaracao.resultadoDeclarado} em {consulta.data.ultimaDeclaracao.declaradaEm} (não verificada).</p>}
      <button type="button" onClick={() => void consulta.refetch()}>Reconsultar fonte local</button>
    </>}
  </section>;
}
