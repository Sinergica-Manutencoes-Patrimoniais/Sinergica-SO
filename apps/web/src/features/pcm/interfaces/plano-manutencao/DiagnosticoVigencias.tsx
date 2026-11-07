import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

const contagem = z.number().int().nonnegative().safe();
const versao = z.object({ versao_id: z.string().guid(), numero: z.number().int().positive().safe(), estado: z.string().min(1).max(100),
  vigencia_inicio: z.string().date().nullable(), vigencia_fim: z.string().date().nullable(), aprovada_em: z.string().datetime({ offset: true }).nullable() }).strict();
export function DiagnosticoVigencias({ userId, clienteId, planoId, revisao }: { userId: string; clienteId: string; planoId: string; revisao: number }) {
  const habilitado = import.meta.env.VITE_SSO_DIAGNOSTICOS_REVISAO_MEDIADOS_ENABLED === "true";
  const resumo = useQuery({ queryKey: ["diagnostico-vigencias", userId, clienteId, planoId, revisao], enabled: habilitado, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_diagnosticar_vigencias_mediado", { p_ator_id: userId, p_cliente_id: clienteId, p_plano_id: planoId, p_expected_revision: revisao }).abortSignal(signal);
      if (error) throw error;
      const r = z.object({ revisao: z.number().int().positive(), versoesAprovadas: contagem, rascunhos: contagem, iniciosIndeterminados: contagem, paresSobrepostos: contagem, eventosAprovacaoEncontrados: contagem, eventosFimVigenciaEncontrados: contagem, auditoriaIntegralComprovada: z.literal(false), aprovacaoAutorizada: z.literal(false) }).passthrough().parse(data);
      if (r.revisao !== revisao) throw new Error("Revisão divergente.");
      await conferirSessaoDiagnostico(userId, signal); return r;
    } });
  const lista = useInfiniteQuery({ queryKey: ["vigencias-revisao", userId, clienteId, planoId, revisao], enabled: habilitado, initialPageParam: 0, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_vigencias_mediado", { p_ator_id: userId, p_cliente_id: clienteId, p_plano_id: planoId, p_expected_revision: revisao, p_apos: pageParam, p_limite: 20 }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(versao).max(20).parse(data); let anterior = pageParam;
      for (const item of pagina) { if (item.numero <= anterior || (item.vigencia_inicio && item.vigencia_fim && item.vigencia_fim < item.vigencia_inicio)) throw new Error("Página divergente."); anterior = item.numero; }
      await conferirSessaoDiagnostico(userId, signal); return pagina;
    }, getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.numero : undefined });
  const itens = lista.data?.pages.flat() ?? [];
  const divergentes = new Set(itens.map((v) => v.versao_id.toLowerCase())).size !== itens.length || itens.some((v, i) => i > 0 && v.numero <= itens[i - 1]!.numero);
  const disponivel = habilitado && !divergentes && !resumo.isFetching && !resumo.isError && !lista.isFetching && !lista.isError;
  return <section aria-label="Diagnóstico de vigências"><h4>Versões e vigências</h4><p>Fotografia informativa; eventos encontrados não comprovam auditoria integral. Não define fuso, não libera edição nem autoriza aprovação.</p>
    {!habilitado && <p>Diagnóstico mediado indisponível.</p>}
    {(resumo.isFetching || lista.isFetching) && <output>Consultando vigências…</output>}
    {resumo.isError && <p role="alert">Diagnóstico indisponível ou revisão alterada. <button type="button" onClick={() => void resumo.refetch()}>Tentar novamente</button></p>}
    {lista.isError && <p role="alert">Lista indisponível. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {divergentes && <p role="alert">Páginas divergentes. <button type="button" onClick={() => void lista.refetch()}>Atualizar lista</button></p>}
    {disponivel && resumo.data && <p>Aprovadas {resumo.data.versoesAprovadas} · rascunhos {resumo.data.rascunhos} · inícios indeterminados {resumo.data.iniciosIndeterminados} · pares sobrepostos {resumo.data.paresSobrepostos} · eventos de aprovação {resumo.data.eventosAprovacaoEncontrados} · eventos de fim de vigência {resumo.data.eventosFimVigenciaEncontrados}</p>}
    {disponivel && <ul>{itens.map((v) => <li key={v.versao_id}>Versão {v.numero} · {v.estado} · {v.vigencia_inicio ?? "início não informado"} a {v.vigencia_fim ?? "sem fim informado"} · aprovação {v.aprovada_em ?? "não informada"}</li>)}</ul>}
    {disponivel && lista.hasNextPage && <button type="button" disabled={lista.isFetching} onClick={() => void lista.fetchNextPage()}>Mais versões</button>}
  </section>;
}
