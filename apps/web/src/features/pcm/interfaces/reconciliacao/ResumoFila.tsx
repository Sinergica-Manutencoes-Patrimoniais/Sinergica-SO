import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const contagem = z.number().int().nonnegative();
const resumo = z.object({ limite: z.literal(1000), considerados: contagem.max(1000), truncado: z.boolean(), pendentes: contagem, processando: contagem, erro: contagem, enviadosNaoConfirmados: contagem, estadoRemoto: z.literal("desconhecido") }).strict();
export function ResumoFila({ userId, clienteId }: { userId: string; clienteId: string }) {
  const consulta = useQuery({ queryKey: ["reconciliacao-resumo", userId, clienteId], gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_resumo_outbox_reconciliacao", { p_cliente_id: clienteId }).abortSignal(signal); if (error) throw error; return resumo.parse(data); } });
  return <section aria-label="Resumo da fila"><h3>Resumo da fila</h3>
    <p>Estado remoto desconhecido; enviado não significa confirmado. O resumo não acompanha o filtro da lista.</p>
    {consulta.isFetching && <output>Consultando resumo...</output>}
    {consulta.isError && <p role="alert">Resumo indisponível ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <>
      <p>{consulta.data.pendentes} pendentes · {consulta.data.processando} processando · {consulta.data.erro} com erro · {consulta.data.enviadosNaoConfirmados} enviados não confirmados.</p>
      <p>{consulta.data.truncado ? `Amostra limitada a ${consulta.data.limite} itens; não representa o total da fila.` : `${consulta.data.considerados} itens considerados no escopo autorizado.`}</p>
    </>}
  </section>;
}
