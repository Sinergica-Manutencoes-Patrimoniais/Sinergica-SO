import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ id: z.string().uuid(), codigo: z.string().min(1).max(200), atual: z.boolean(), ator_id: z.string().uuid(), criado_em: z.string().datetime({ offset: true }) }).strict();
type Cursor = { data: string; id: string } | null;

export function HistoricoCodigoGrupo({ userId, clienteId, grupoId }: { userId: string; clienteId: string; grupoId: string }) {
  const [aberto, setAberto] = useState(false);
  const ativo = import.meta.env.VITE_SSO_HISTORICO_CODIGO_GRUPO_ENABLED === "true";
  const consulta = useInfiniteQuery({
    queryKey: ["codigos-publicos", userId, clienteId, "historico-grupo", grupoId],
    enabled: ativo && aberto, gcTime: 0, retry: false, initialPageParam: null as Cursor,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_historico_codigo_grupo", {
        p_cliente_id: clienteId, p_grupo_id: grupoId, p_apos: pageParam?.data ?? null, p_apos_id: pageParam?.id ?? null, p_limite: 20,
      }).abortSignal(signal);
      if (error) throw error;
      const resultado = z.array(linha).max(20).parse(data);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return resultado;
    },
    getNextPageParam: (pagina): Cursor | undefined => {
      const ultima = pagina.length === 20 ? pagina.at(-1) : undefined;
      return ultima ? { data: ultima.criado_em, id: ultima.id } : undefined;
    },
  });
  if (!ativo) return null;
  const itens = consulta.data?.pages.flat() ?? [];
  const ids = new Set(itens.map((item) => item.id.toLowerCase()));
  const codigos = new Set(itens.map((item) => item.codigo.trim().toUpperCase()));
  const historicoDivergente = ids.size !== itens.length || codigos.size !== itens.length || itens.filter((item) => item.atual).length > 1;
  return <section aria-label="Histórico de códigos do Grupo">
    <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar histórico" : "Consultar histórico"}</button>
    {aberto && <><p>Histórico de códigos registrados; não comprova atualização de etiquetas físicas.</p>
      {consulta.isFetching && <output>Consultando histórico…</output>}
      {consulta.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
      {!consulta.isFetching && !consulta.isError && historicoDivergente && <p role="alert">Histórico divergente entre páginas. Atualize a consulta antes de usar os códigos. <button type="button" onClick={() => void consulta.refetch()}>Atualizar histórico</button></p>}
      {!consulta.isFetching && !consulta.isError && !historicoDivergente && consulta.data && <><ol>{itens.map((item) => <li key={item.id}>{item.codigo} · {item.atual ? "atual" : "anterior"} · responsável {item.ator_id} · <time dateTime={item.criado_em}>{new Date(item.criado_em).toLocaleString("pt-BR")}</time>{!item.atual && <MotivoCorrecao userId={userId} clienteId={clienteId} grupoId={grupoId} codigoId={item.id} />}</li>)}</ol>
        {itens.length === 0 && <p>Nenhum código registrado.</p>}</>}
      {!historicoDivergente && consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais códigos</button>}
    </>}
  </section>;
}

function MotivoCorrecao({ userId, clienteId, grupoId, codigoId }: { userId: string; clienteId: string; grupoId: string; codigoId: string }) {
  const [aberto, setAberto] = useState(false);
  const ativo = import.meta.env.VITE_SSO_MOTIVO_CODIGO_GRUPO_ENABLED === "true";
  const consulta = useQuery({
    queryKey: ["codigos-publicos", userId, clienteId, "motivo-grupo", grupoId, codigoId], enabled: ativo && aberto, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_motivo_codigo_historico_grupo", { p_cliente_id: clienteId, p_grupo_id: grupoId, p_codigo_id: codigoId }).abortSignal(signal);
      if (error) throw error;
      const r = z.object({ codigoId: z.string().uuid(), grupoId: z.string().uuid(), clienteId: z.string().uuid(), motivo: z.string().min(1).max(2000), atorId: z.string().uuid(), data: z.string().datetime({ offset: true }) }).strict().nullable().parse(data);
      if (r && (r.codigoId !== codigoId || r.grupoId !== grupoId || r.clienteId !== clienteId)) throw new Error("Resposta divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return r;
    },
  });
  if (!ativo) return null;
  return <section aria-label="Motivo da correção"><button type="button" aria-expanded={aberto} onClick={() => setAberto(v => !v)}>{aberto ? "Ocultar motivo" : "Consultar motivo"}</button>
    {aberto && <>{consulta.isFetching && <output>Consultando motivo…</output>}{consulta.isError && <p role="alert">Motivo indisponível ou acesso não autorizado. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
      {!consulta.isFetching && !consulta.isError && consulta.data === null && <p>Evento de correção não encontrado nesta consulta.</p>}
      {!consulta.isFetching && !consulta.isError && consulta.data && <p>Motivo: {consulta.data.motivo} · responsável {consulta.data.atorId} · <time dateTime={consulta.data.data}>{new Date(consulta.data.data).toLocaleString("pt-BR")}</time></p>}</>}
  </section>;
}
