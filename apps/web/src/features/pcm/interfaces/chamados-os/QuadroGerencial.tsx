import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseChamadosOsLeituraAdapter } from "../../infrastructure/supabase-chamados-os-leitura-adapter";
import { OrdensDoChamado } from "./OrdensDoChamado";

const inteiro = z.union([z.number(), z.string().regex(/^\d+$/)]).refine((v) => Number.isSafeInteger(Number(v)) && Number(v) >= 0).transform(Number);
const cardSchema = z.object({ id: z.string().uuid(), numero: z.string().min(1), titulo: z.string(), status_chamado: z.string(),
  total_os: inteiro.nullable(), finalizadas: inteiro.nullable(), etapas_mistas: z.boolean().nullable(), vinculo_inconsistente: z.boolean() }).strict()
  .refine((v) => v.vinculo_inconsistente
    ? v.total_os === null && v.finalizadas === null && v.etapas_mistas === null
    : v.total_os !== null && v.finalizadas !== null && v.etapas_mistas !== null && v.finalizadas <= v.total_os && (v.total_os > 1 || !v.etapas_mistas));

export function QuadroGerencial({ usuario, cliente, onAbrirOs }: { usuario: string; cliente: string; onAbrirOs?: (id: string) => void }) {
  return <Quadro key={JSON.stringify([usuario, cliente])} usuario={usuario} cliente={cliente} onAbrirOs={onAbrirOs} />;
}

function Quadro({ usuario, cliente, onAbrirOs }: { usuario: string; cliente: string; onAbrirOs?: (id: string) => void }) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const consulta = useInfiniteQuery({
    queryKey: ["s167-quadro-gerencial", usuario, cliente], enabled: Boolean(usuario && cliente), gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_chamados_gerenciais_v2", { p_cliente_id: cliente, p_apos: pageParam, p_limite: 50 }).abortSignal(signal);
      if (error) throw error;
      const itens = z.array(cardSchema).max(50).parse(data);
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const item of itens) {
        const atual = item.id.toLowerCase();
        if (anterior !== null && atual <= anterior) throw new Error("Página inválida.");
        anterior = atual;
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      return itens;
    },
    getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.id : undefined,
  });
  const itens = consulta.data?.pages.flat() ?? [];
  const paginasDivergentes = new Set(itens.map((item) => item.id.toLowerCase())).size !== itens.length;
  return <section aria-label="Visão gerencial de Chamados" className="mb-4 rounded-lg border border-line p-3">
    <h3 className="font-semibold">Visão gerencial de Chamados</h3>
    <p>Um card por Chamado; a visão operacional de OS continua disponível abaixo. Progresso não indica encerramento.</p>
    {consulta.isFetching && <output>Carregando Chamados…</output>}
    {consulta.isError && !consulta.isFetching && <p role="alert">Não foi possível carregar Chamados. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && paginasDivergentes && <p role="alert">Os Chamados mudaram durante a consulta. <button type="button" onClick={() => { setSelecionado(null); void consulta.refetch(); }}>Atualizar quadro</button></p>}
    {!consulta.isFetching && !consulta.isError && !paginasDivergentes && consulta.data && <>
      {itens.length === 0 ? <p>Nenhum Chamado encontrado.</p> : <ul>{itens.map((item) => <li key={item.id} className="my-2 rounded border border-line p-2">
        <p>{item.numero} · {item.titulo} · {item.etapas_mistas ? "Em andamento" : item.status_chamado}</p>
        {item.vinculo_inconsistente ? <p role="alert">Vínculo de OS inconsistente. Encaminhe para conferência do PCM; progresso indisponível.</p> : <>
          {item.total_os !== null && item.total_os > 0 && <p>{item.finalizadas} de {item.total_os} OS finalizadas</p>}
          {item.total_os === 0 && <p>Sem OS vinculadas</p>}
          <button type="button" aria-expanded={selecionado === item.id} onClick={() => setSelecionado((atual) => atual === item.id ? null : item.id)}>Ver OS de {item.numero}</button>
          {selecionado === item.id && <OrdensDoChamado usuario={usuario} cliente={cliente} chamado={item.id} leitura={supabaseChamadosOsLeituraAdapter} onAbrirOs={onAbrirOs} />}
        </>}
      </li>)}</ul>}
      {consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais Chamados</button>}
    </>}
  </section>;
}
