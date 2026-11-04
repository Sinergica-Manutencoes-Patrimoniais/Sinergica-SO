import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { chamadosOsQueryKeys } from "../../application/chamados-os-queries";
import { resumirProgressoChamado } from "../../domain/progresso-chamado";
import { MateriaisDaOrdem } from "./MateriaisDaOrdem";

const paginaSchema = z.object({ clienteId: z.string().uuid(), chamadoId: z.string().uuid(), total: z.number().int().min(0).max(10000),
  assinatura: z.string().regex(/^[a-f0-9]{64}$/), itens: z.array(z.object({ id: z.string().uuid(), numero: z.string().max(1000),
    titulo: z.string().max(10000), status: z.string().max(200) }).strict()).max(20) }).strict();
type Cursor = { apos: string | null; assinatura: string | null; total: number | null; recebidos: number };

/** Fotografia observável; não substitui autorização, nem prova ausência de mudanças revertidas. */
export function OrdensChamadoFotografia({ usuario, cliente, chamado, onAbrirOs }: {
  usuario: string; cliente: string; chamado: string; onAbrirOs?: (id: string) => void;
}) {
  const consulta = useInfiniteQuery({
    queryKey: [...chamadosOsQueryKeys.ordens(usuario, cliente, chamado), "fotografia"],
    enabled: Boolean(usuario && cliente && chamado), gcTime: 0, retry: false, refetchOnWindowFocus: true,
    initialPageParam: { apos: null, assinatura: null, total: null, recebidos: 0 } as Cursor,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_ordens_chamado_foto", {
        p_cliente_id: cliente, p_chamado_id: chamado, p_limite: 20,
        p_apos: pageParam.apos, p_assinatura: pageParam.assinatura,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = paginaSchema.parse(data);
      const depois = await supabase.auth.getUser(); signal.throwIfAborted();
      if (depois.error || depois.data.user?.id !== usuario || pagina.clienteId !== cliente || pagina.chamadoId !== chamado ||
        (pageParam.assinatura !== null && pagina.assinatura !== pageParam.assinatura) ||
        (pageParam.total !== null && pagina.total !== pageParam.total) ||
        pagina.itens.length !== Math.min(20, pagina.total - pageParam.recebidos)) throw new Error("Fotografia divergente.");
      let anterior = pageParam.apos ?? "";
      for (const item of pagina.itens) { if (item.id <= anterior) throw new Error("Página divergente."); anterior = item.id; }
      return { ...pagina, recebidos: pageParam.recebidos + pagina.itens.length };
    },
    getNextPageParam: (pagina): Cursor | undefined => pagina.recebidos < pagina.total
      ? { apos: pagina.itens.at(-1)!.id, assinatura: pagina.assinatura, total: pagina.total, recebidos: pagina.recebidos } : undefined,
  });
  const ordens = consulta.data?.pages.flatMap((pagina) => pagina.itens) ?? [];
  const completa = !consulta.isFetching && !consulta.isError && !!consulta.data && !consulta.hasNextPage &&
    consulta.data.pages.at(-1)?.recebidos === consulta.data.pages[0]?.total;
  const progresso = resumirProgressoChamado(ordens.map((os) => os.status), completa);
  return <section className="border-t border-line-soft px-4 py-3" aria-label="Ordens de Serviço vinculadas">
    <h3 className="font-semibold">Ordens de Serviço vinculadas</h3>
    <p>Fotografia conferida entre páginas; mudanças revertidas podem não ser detectadas. A lista não comprova encerramento do Chamado.</p>
    {consulta.isFetching && <output>Consultando Ordens de Serviço…</output>}
    {consulta.isError && <p role="alert">Lista indisponível ou alterada. <button type="button" onClick={() => void consulta.refetch()}>Recarregar</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <>
      {progresso && <p>{progresso.finalizadas} de {progresso.total} OS finalizadas{progresso.etapasMistas && " · Em andamento"}</p>}
      {ordens.length === 0 ? <p>Nenhuma Ordem de Serviço vinculada.</p> : <ul>{ordens.map((os) => <li key={os.id}>
        {os.numero} · {os.titulo} · {os.status} {onAbrirOs && <button type="button" onClick={() => onAbrirOs(os.id)}>Abrir OS {os.numero}</button>}
        <MateriaisDaOrdem usuario={usuario} cliente={cliente} ordem={os.id} numero={os.numero} />
      </li>)}</ul>}
      {consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Carregar mais Ordens de Serviço</button>}
    </>}
  </section>;
}
