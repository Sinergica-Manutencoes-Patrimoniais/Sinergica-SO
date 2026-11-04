import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ObservacoesReserva } from "./ObservacoesReserva";
import { RecuperarObservacoesReserva } from "./RecuperarObservacoesReserva";

const linha = z.object({ outbox_id: z.string().uuid(), componente_id: z.string().uuid(), nome: z.string().min(1), status_local: z.enum(["pending", "processing", "sent", "error"]), criado_em: z.string().datetime({ offset: true }) }).strict();
type Props = { userId: string; clienteId: string };
function DetalheObservacoes(props: Props & { outboxId: string; componenteId: string }) {
  const [aberto, setAberto] = useState(false);
  if (import.meta.env.VITE_SSO_OBSERVACOES_RESERVA_EQUIPMENT_ENABLED !== "true") return null;
  return <><button type="button" aria-expanded={aberto} onClick={() => setAberto(v => !v)}>{aberto ? "Ocultar observações" : "Consultar observações"}</button>{aberto && <ObservacoesReserva {...props} />}</>;
}
export function ReservasEquipment(props: Props) {
  if (import.meta.env.VITE_SSO_RESERVAS_EQUIPMENT_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function Conteudo({ userId, clienteId }: Props) {
  const q = useInfiniteQuery({ queryKey: ["reservas-equipment", userId, clienteId], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const parametros = { p_ator_id: userId, p_cliente_id: clienteId, p_apos: pageParam, p_limite: 30 };
      const requisicao = import.meta.env.VITE_SSO_RESERVAS_EQUIPMENT_MEDIADA_ENABLED === "true"
        ? supabase.schema("pcm").rpc("sso_listar_reservas_equipment_mediada", parametros)
        : supabase.schema("pcm").rpc("sso_listar_reservas_equipment", parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(30).parse(data); let anterior = pageParam?.toLowerCase() ?? null;
      for (const item of pagina) { const id = item.outbox_id.toLowerCase(); if (anterior !== null && id <= anterior) throw new Error("Página inconsistente."); anterior = id; }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    }, getNextPageParam: p => p.length === 30 ? p[p.length-1]?.outbox_id : undefined,
  });
  return <section aria-label="Reservas pendentes de Equipment"><h2>Envios Equipment em conferência</h2>
    <p>A situação local não confirma o resultado no Auvo. Não repetir envio antes da reconciliação.</p>
    {import.meta.env.VITE_SSO_RECUPERAR_OBSERVACOES_RESERVA_ENABLED === "true" && <RecuperarObservacoesReserva userId={userId} clienteId={clienteId} />}
    {q.isFetching && <output>Consultando reservas…</output>}
    {q.isError && <p role="alert">Reservas indisponíveis. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {!q.isFetching && !q.isError && q.data && <>{q.data.pages.flat().length === 0 ? <p>Nenhuma reserva encontrada. Isso não comprova ausência de envios anteriores.</p> : <ul>{q.data.pages.flat().map(item => <li key={item.outbox_id}>{item.nome} · Componente {item.componente_id} · fila {item.outbox_id} · situação local {item.status_local} · reserva {new Date(item.criado_em).toLocaleString("pt-BR")}<DetalheObservacoes userId={userId} clienteId={clienteId} outboxId={item.outbox_id} componenteId={item.componente_id} /></li>)}</ul>}{q.hasNextPage && <button type="button" onClick={() => void q.fetchNextPage()}>Mais reservas</button>}</>}
  </section>;
}
