import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { DemorasObservadas } from "./DemorasObservadas";

const linha = z.object({ outbox_id: z.string().guid(), entidade: z.enum(["sistemas", "equipamentos"]), objeto_id: z.string().guid(),
  iniciado_em: z.string().datetime({ offset: true }).nullable(), classificacao: z.enum(["inicio_desconhecido", "tempo_excedido_observado"]),
  observado_em: z.string().datetime({ offset: true }) }).strict();
export function ProcessamentosDemorados({ userId, clienteId }: { userId: string; clienteId: string }) {
  const [minutos, setMinutos] = useState("");
  const [filtro, setFiltro] = useState<number | null>(null);
  const consulta = useInfiniteQuery({
    queryKey: ["reconciliacao-processamentos-demorados", userId, clienteId, filtro], initialPageParam: null as string | null,
    gcTime: 0, enabled: filtro !== null, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_processamentos_demorados", {
        p_ator_id: userId, p_cliente_id: clienteId, p_minutos: filtro, p_apos: pageParam, p_limite: 50,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(50).parse(data); let anterior = pageParam ?? "";
      for (const item of pagina) { if (item.outbox_id <= anterior) throw new Error("Página divergente"); anterior = item.outbox_id; }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.outbox_id : undefined,
  });
  const atual = filtro !== null && Number(minutos) === filtro && !consulta.isFetching && !consulta.isError;
  const itens = atual ? (consulta.data?.pages.flat() ?? []) : [];
  return <section aria-label="Processamentos para conferência">
    <h4>Processamentos para conferência</h4>
    {import.meta.env.VITE_SSO_DEMORAS_OBSERVADAS_ENABLED === "true" && <DemorasObservadas key={`${userId}:${clienteId}`} userId={userId} clienteId={clienteId} />}
    <p>Escolha um limite em minutos. A lista inclui também inícios desconhecidos. Nenhum item é considerado abandonado ou seguro para reenvio.</p>
    <form onSubmit={(e) => { e.preventDefault(); const valor = Number(minutos); if (Number.isInteger(valor) && valor >= 1 && valor <= 10080) {
      if (valor === filtro) void consulta.refetch(); else setFiltro(valor);
    } }}>
      <label>Limite em minutos <input type="number" min={1} max={10080} required value={minutos} onChange={(e) => setMinutos(e.target.value)} /></label>
      <button type="submit" disabled={consulta.isFetching}>Consultar</button>
    </form>
    {consulta.isFetching && <p role="status">Consultando…</p>}
    {consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {atual && consulta.data && (itens.length === 0 ? <p>Nenhum item encontrado nesta consulta.</p> : <ul>{itens.map((item) => <li key={item.outbox_id}>
      Item {item.outbox_id} · {item.entidade === "equipamentos" ? "Componente" : "Sistema"} {item.objeto_id} ·
      {item.classificacao === "inicio_desconhecido" ? " início desconhecido" : " limite informado ultrapassado"} · início {item.iniciado_em ?? "não registrado"} · consulta {item.observado_em}
    </li>)}</ul>)}
    {atual && consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais itens</button>}
  </section>;
}
