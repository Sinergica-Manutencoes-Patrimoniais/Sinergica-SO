import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { TriagemChamadoProvisorio } from "./TriagemChamadoProvisorio";
import { DetalheUltimoEvento } from "./DetalheUltimoEvento";
import { ConflitosCampo } from "./ConflitosCampo";

const item = z.object({ os_id: z.string().guid(), chamado_id: z.string().guid(), provisorio: z.boolean(), status_os: z.string(),
  status_campo: z.enum(["aberta", "em_andamento", "concluida"]), ordem_externa: z.string().regex(/^[1-9]\d{0,17}$/),
  conflitos: z.number().int().nonnegative().safe(), validacao_comprovada: z.literal(false) }).strict();
const rotulos = { aberta: "Aberta em campo", em_andamento: "Em andamento em campo", concluida: "Concluída em campo — conferir validação PCM" } as const;

export function EstadoCampo({ userId, clienteId, onAbrirOs }: { userId: string; clienteId: string; onAbrirOs?: (osId: string) => void }) {
  if (import.meta.env.VITE_SSO_ESTADO_CAMPO_ENABLED !== "true") return null;
  return <Conteudo key={`${userId}:${clienteId}`} userId={userId} clienteId={clienteId} onAbrirOs={onAbrirOs} />;
}
function Conteudo({ userId, clienteId, onAbrirOs }: { userId: string; clienteId: string; onAbrirOs?: (osId: string) => void }) {
  const q = useInfiniteQuery({ queryKey: ["estado-origem-campo", userId, clienteId], gcTime: 0, refetchOnWindowFocus: true,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_estado_campo", { p_ator_id: userId, p_cliente_id: clienteId, p_apos: pageParam, p_limite: 20 }).abortSignal(signal);
      if (error) throw error;
      const itens = z.array(item).max(20).parse(data); let anterior = pageParam?.toLowerCase() ?? null;
      for (const linha of itens) { const id = linha.os_id.toLowerCase(); if (anterior !== null && id <= anterior) throw new Error("Página divergente."); anterior = id; }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return itens;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.os_id : undefined });
  const carregados = q.data?.pages.flat() ?? [];
  const consistentes = carregados.every((item, indice) => indice === 0 || carregados[indice - 1]!.os_id.toLowerCase() < item.os_id.toLowerCase());
  const itens = !q.isFetching && !q.isError && consistentes ? carregados : [];
  return <section aria-label="Situação das tarefas de campo">
    <h2>Situação das tarefas de campo</h2>
    <p>Registro de origem consultado; não comprova execução, validação do PCM ou encerramento do Chamado. Conflitos exigem triagem.</p>
    {q.isFetching && <output>Consultando tarefas…</output>}
    {q.isError && <p role="alert">Situação indisponível. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {!consistentes && <p role="alert">As páginas da consulta divergiram. <button type="button" onClick={() => void q.refetch()}>Atualizar</button></p>}
    {!q.isFetching && !q.isError && consistentes && itens.length === 0 && <p>Nenhuma tarefa nesta consulta; isso não prova ausência de trabalho em campo.</p>}
    <ul>{itens.map((i) => <li key={i.os_id}>OS {i.os_id} · Chamado {i.chamado_id} {i.provisorio && "· origem provisória"} · {rotulos[i.status_campo]} · situação da OS {i.status_os} · {i.conflitos} conflito(s) registrado(s).
      {onAbrirOs && <button type="button" onClick={() => onAbrirOs(i.os_id)}>Abrir OS</button>}
      {import.meta.env.VITE_SSO_DETALHE_EVENTO_CAMPO_ENABLED === "true" && <DetalheUltimoEvento userId={userId} clienteId={clienteId} osId={i.os_id} />}
      {i.conflitos > 0 && import.meta.env.VITE_SSO_CONFLITOS_CAMPO_ENABLED === "true" && <ConflitosCampo userId={userId} clienteId={clienteId} osId={i.os_id} />}
      {i.provisorio && <TriagemChamadoProvisorio userId={userId} clienteId={clienteId} osId={i.os_id} />}</li>)}</ul>
    {q.hasNextPage && !q.isError && consistentes && <button type="button" disabled={q.isFetching} onClick={() => void q.fetchNextPage()}>Mais tarefas</button>}
  </section>;
}
