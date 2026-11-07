import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ chave: z.string().min(1).max(200), tipo: z.string(), referencia_pai: z.string().nullable(), pai_tipo: z.string().nullable(),
  revisao: z.number().int().positive(), problemas: z.array(z.enum(["area_nao_admite_pai", "pai_nao_encontrado_no_lote", "ancestral_nao_encontrado_no_lote", "ciclo_hierarquia", "cadeia_extensa", "tipo_pai_incompativel"])) }).strict();
const descricao: Record<string, string> = { area_nao_admite_pai: "Área não admite pai", pai_nao_encontrado_no_lote: "Pai não encontrado no lote; conferir cadastro externo",
  ancestral_nao_encontrado_no_lote: "Um ancestral tem referência ausente no lote",
  ciclo_hierarquia: "Ciclo na hierarquia", cadeia_extensa: "Cadeia excede o limite de análise", tipo_pai_incompativel: "Tipo de pai incompatível" };
function compararUtf8(a: string, b: string) {
  const codificador = new TextEncoder(); const esquerda = codificador.encode(a); const direita = codificador.encode(b);
  for (let i = 0; i < Math.min(esquerda.length, direita.length); i++) if (esquerda[i] !== direita[i]) return esquerda[i]! - direita[i]!;
  return esquerda.length - direita.length;
}

export function DiagnosticoHierarquia({ userId, clienteId, loteId, revisao, onRevisar }: {
  userId: string; clienteId: string; loteId: string; revisao: number; onRevisar?: (chave: string) => void;
}) {
  const consulta = useInfiniteQuery({ queryKey: ["levantamentos", userId, clienteId, loteId, "hierarquia-diagnostico", revisao], initialPageParam: null as string | null,
    gcTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      const parametros = { p_cliente_id: clienteId, p_lote_id: loteId, p_revision: revisao, p_apos: pageParam, p_limite: 30 };
      const requisicao = import.meta.env.VITE_SSO_DIAGNOSTICO_ANCESTRAL_ENABLED === "true"
        ? supabase.schema("pcm").rpc("sso_diagnosticar_hierarquia_lote_v2", { ...parametros, p_ator_id: userId })
        : import.meta.env.VITE_SSO_DIAGNOSTICO_HIERARQUIA_MEDIADO_ENABLED === "true"
        ? supabase.schema("pcm").rpc("sso_diagnosticar_hierarquia_lote_mediado", { ...parametros, p_ator_id: userId })
        : supabase.schema("pcm").rpc("sso_diagnosticar_hierarquia_lote", parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error; const pagina = z.array(linha).max(30).parse(data); let anterior = pageParam;
      for (const item of pagina) { if (item.revisao !== revisao || (anterior !== null && compararUtf8(item.chave, anterior) <= 0)) throw new Error("Página divergente"); anterior = item.chave; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 30 ? pagina.at(-1)?.chave : undefined,
  });
  const itens = consulta.data?.pages.flat() ?? [];
  return <section aria-label="Diagnóstico de hierarquia do lote">
    <h4>Hierarquia do lote</h4>
    <p>Referência fora do lote precisa de conferência; ausência de alerta não comprova cadastro oficial ou aprovação.</p>
    {consulta.isFetching && <p role="status">Consultando hierarquia…</p>}
    {consulta.isError && <p role="alert">Diagnóstico indisponível ou lote alterado. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && (itens.length === 0 ? <p>Nenhuma linha encontrada.</p> : <ul>{itens.map((item) => <li key={item.chave}>
      {item.chave} · {item.tipo} · pai {item.referencia_pai ?? "não informado"} {item.pai_tipo ? `(${item.pai_tipo})` : ""}: {item.problemas.length ? item.problemas.map((p) => descricao[p]).join("; ") : "sem alerta nesta consulta"}.
      {onRevisar && <button type="button" onClick={() => onRevisar(item.chave)}>Revisar linha {item.chave}</button>}
    </li>)}</ul>)}
    {consulta.hasNextPage && !consulta.isError && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais linhas</button>}
  </section>;
}
