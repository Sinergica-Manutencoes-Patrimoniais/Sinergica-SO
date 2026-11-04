import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { EvidenciasOs } from "./EvidenciasOs";
import { ReconciliarReservaLegada } from "./ReconciliarReservaLegada";

const itemSchema = z.object({ reserva_id: z.string().uuid(), os_id: z.string().uuid(),
  criado_em: z.string().refine((v) => Number.isFinite(Date.parse(v))) }).strict();

export function ReservasEnvioLegado({ userId, clienteId, onAbrirOs }: { userId: string; clienteId: string; onAbrirOs?: (osId: string) => void }) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const consulta = useInfiniteQuery({ queryKey: ["reservas-envio-legado", userId, clienteId], gcTime: 0, retry: false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_reservas_envio_legado", {
        p_ator_id: userId, p_cliente_id: clienteId, p_apos: pageParam, p_limite: 50,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(itemSchema).max(50).parse(data);
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const item of pagina) {
        const atual = item.reserva_id.toLowerCase();
        if (atual <= anterior) throw new Error("Página divergente.");
        anterior = atual;
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    }, getNextPageParam: (p) => p.length === 50 ? p.at(-1)?.reserva_id : undefined,
  });
  const itens = !consulta.isFetching && !consulta.isError ? consulta.data?.pages.flat() : undefined;
  return <section aria-label="Envios legados aguardando reconciliação">
    <h4>Envios legados aguardando reconciliação</h4>
    <p>Uma reserva pendente não comprova que a tarefa foi criada ou que o envio parou. Esta consulta não reenvia nem libera a reserva.</p>
    {consulta.isFetching && <p>Consultando reservas…</p>}
    {consulta.isError && <p role="alert">Reservas indisponíveis. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {itens?.length === 0 && <p>Nenhuma reserva pendente nesta consulta.</p>}
    {itens?.map((item) => <div key={item.reserva_id}>
      <p>OS {item.os_id} · reserva {item.reserva_id} · {new Date(item.criado_em).toLocaleString("pt-BR")}{onAbrirOs && <> <button type="button" onClick={() => onAbrirOs(item.os_id)}>Abrir OS</button></>} <button type="button" onClick={() => setSelecionada(selecionada === item.reserva_id ? null : item.reserva_id)}>{selecionada === item.reserva_id ? "Ocultar evidências" : "Consultar evidências da OS"}</button></p>
      {selecionada === item.reserva_id && <EvidenciasOs key={`${userId}:${clienteId}:${item.os_id}`} userId={userId} clienteId={clienteId} osId={item.os_id} />}
    </div>)}
    <ReconciliarReservaLegada userId={userId} clienteId={clienteId} reserva={itens?.find(item => item.reserva_id === selecionada) ? {
      reservaId: selecionada!, osId: itens.find(item => item.reserva_id === selecionada)!.os_id,
    } : null} />
    {consulta.hasNextPage && !consulta.isError && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais reservas</button>}
  </section>;
}
