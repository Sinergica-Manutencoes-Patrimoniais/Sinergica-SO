import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { useState } from "react";
import { HistoricoDemora } from "./HistoricoDemora";

const item = z.object({ outbox_id: z.string().uuid(), entidade: z.enum(["sistemas", "equipamentos"]), objeto_id: z.string().uuid(),
  estado: z.enum(["inicio_desconhecido", "tempo_excedido_observado", "processamento_encerrado_na_fonte", "novo_processamento_observado"]),
  iniciado_em: z.string().datetime({ offset: true }).nullable(), limite_minutos: z.number().int().min(1).max(10080),
  revisao: z.number().int().positive(), atualizado_em: z.string().datetime({ offset: true }) }).strict();
const rotulos: Record<z.infer<typeof item>["estado"], string> = { inicio_desconhecido: "início desconhecido", tempo_excedido_observado: "limite observado ultrapassado",
  processamento_encerrado_na_fonte: "processamento deixou esse estado na fonte", novo_processamento_observado: "novo processamento observado" };
export function DemorasObservadas({ userId, clienteId }: { userId: string; clienteId: string }) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const consulta = useInfiniteQuery({ queryKey: ["reconciliacao-demoras-observadas", userId, clienteId], initialPageParam: null as string | null, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_demoras_observadas", { p_ator_id: userId, p_cliente_id: clienteId, p_apos: pageParam, p_limite: 50 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(item).max(50).parse(data); let anterior = pageParam ?? "";
      for (const linha of pagina) { if (linha.outbox_id <= anterior) throw new Error("Página divergente"); anterior = linha.outbox_id; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada"); return pagina;
    }, getNextPageParam: (p) => p.length === 50 ? p.at(-1)?.outbox_id : undefined });
  return <section aria-label="Demoras registradas"><h5>Demoras registradas pela varredura</h5>
    <p>Última observação local, não necessariamente o estado atual. Encerramento na fonte não comprova sucesso remoto nem permite reenvio.</p>
    {consulta.isFetching && <p role="status">Consultando observações…</p>}
    {consulta.isError && <p role="alert">Observações indisponíveis. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && (consulta.data.pages.flat().length === 0 ? <p>Nenhuma observação registrada nesta consulta.</p> :
      <ul>{consulta.data.pages.flat().map((x) => <li key={x.outbox_id}>Item {x.outbox_id} · {x.entidade === "equipamentos" ? "Componente" : "Sistema"} {x.objeto_id} · {rotulos[x.estado]} · início {x.iniciado_em ?? "desconhecido"} · limite {x.limite_minutos} min · revisão {x.revisao} · observado {x.atualizado_em}
        {import.meta.env.VITE_SSO_HISTORICO_DEMORA_ENABLED === "true" && <><button type="button" aria-expanded={selecionado === x.outbox_id} onClick={() => setSelecionado(selecionado === x.outbox_id ? null : x.outbox_id)}>Consultar histórico</button>
          {selecionado === x.outbox_id && <HistoricoDemora key={`${userId}:${clienteId}:${x.outbox_id}`} userId={userId} clienteId={clienteId} outboxId={x.outbox_id} />}</>}</li>)}</ul>)}
    {consulta.hasNextPage && !consulta.isFetching && !consulta.isError && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais observações</button>}
  </section>;
}
