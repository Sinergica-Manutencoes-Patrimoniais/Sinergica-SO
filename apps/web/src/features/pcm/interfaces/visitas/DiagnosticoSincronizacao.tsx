import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const contagem = z.number().int().nonnegative();
const resultado = z.object({
  visitaId: z.string().uuid(),
  os: z.object({ total: contagem, semTarefaLocal: contagem, estadoPendente: contagem, estadoErro: contagem }).strict(),
  equipe: z.object({ total: contagem, itensFilaPendentes: contagem, itensFilaProcessando: contagem, itensFilaErro: contagem }).strict(),
  situacaoRemota: z.literal("desconhecida"),
  autorizaEnvio: z.literal(false),
}).strict();

export function DiagnosticoSincronizacao({ userId, clienteId, visitaId }: { userId: string; clienteId: string; visitaId: string }) {
  const consulta = useQuery({
    queryKey: ["visita-diagnostico-sync", userId, clienteId, visitaId],
    gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_diagnostico_sincronizacao_visita", { p_cliente_id: clienteId, p_visita_id: visitaId }).abortSignal(signal);
      if (error) throw error;
      const valor = resultado.parse(data);
      if (valor.visitaId !== visitaId) throw new Error("Visita divergente");
      return valor;
    },
  });
  return <section aria-label="Diagnóstico de sincronização" className="space-y-2 rounded border border-line p-3">
    <h3>Diagnóstico de sincronização</h3>
    <p>A situação remota no Auvo é desconhecida. Este diagnóstico não envia nem confirma sincronização.</p>
    {consulta.isFetching && <output>Consultando registros locais...</output>}
    {consulta.isError && <p role="alert">Não foi possível consultar o diagnóstico. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <>
      <p>OS: {consulta.data.os.total} no total; {consulta.data.os.semTarefaLocal} sem identificação local de tarefa; {consulta.data.os.estadoPendente} com estado local pendente; {consulta.data.os.estadoErro} com erro local.</p>
      <p>Equipe: {consulta.data.equipe.total} pessoas; itens de fila: {consulta.data.equipe.itensFilaPendentes} pendentes, {consulta.data.equipe.itensFilaProcessando} processando, {consulta.data.equipe.itensFilaErro} com erro.</p>
      <p>Os itens são contagens de fila, não pessoas. Uma pessoa compartilhada pode aparecer em mais de uma Visita; ausência de pendências não comprova sincronização.</p>
    </>}
  </section>;
}
