import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";
import { z } from "zod";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

const contagem = z.number().int().nonnegative().safe();
const osSchema = z.object({ os_id: z.string().guid(), ocorrencia_id: z.string().guid(), rotina_id: z.string().guid(), vencimento_original: z.string().date(), status: z.string().min(1).max(100) }).strict();

export function DiagnosticoOsRevisao({ userId, clienteId, planoId, revisao }: { userId: string; clienteId: string; planoId: string; revisao: number }) {
  const habilitado = import.meta.env.VITE_SSO_DIAGNOSTICOS_REVISAO_MEDIADOS_ENABLED === "true";
  const consulta = useQuery({ queryKey: ["diagnostico-os-revisao", userId, clienteId, planoId, revisao], enabled: habilitado, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_diagnosticar_os_revisao_mediado", { p_ator_id: userId, p_cliente_id: clienteId, p_plano_id: planoId, p_expected_revision: revisao }).abortSignal(signal);
      if (error) throw error;
      const r = z.object({ revisao: z.number().int().positive(), ocorrenciasCalendarioPreparadas: contagem, ocorrenciasSemPonte: contagem, osVinculadasMesmoCliente: contagem, osAbertasMesmoCliente: contagem, osClienteDivergente: contagem, fontesIncompletas: z.literal(true), impactoOperacionalCalculado: z.literal(false), ausenciaDeImpactoComprovada: z.literal(false) }).passthrough().parse(data);
      if (r.revisao !== revisao || r.osAbertasMesmoCliente > r.osVinculadasMesmoCliente || r.ocorrenciasSemPonte > r.ocorrenciasCalendarioPreparadas) throw new Error("Diagnóstico divergente.");
      await conferirSessaoDiagnostico(userId, signal); return r;
    } });
  const abertas = useInfiniteQuery({ queryKey: ["os-abertas-revisao", userId, clienteId, planoId, revisao], enabled: habilitado, initialPageParam: null as string | null, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_os_revisao_mediada", { p_ator_id: userId, p_cliente_id: clienteId, p_plano_id: planoId, p_expected_revision: revisao, p_apos: pageParam, p_limite: 20 }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(osSchema).max(20).parse(data); let anterior = pageParam?.toLowerCase() ?? "";
      for (const os of pagina) { const atual = os.os_id.toLowerCase(); if (atual <= anterior) throw new Error("Página divergente."); anterior = atual; }
      await conferirSessaoDiagnostico(userId, signal); return pagina;
    }, getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.os_id : undefined });
  const itens = abertas.data?.pages.flat() ?? [];
  const divergentes = itens.some((os, indice) => indice > 0 && os.os_id.toLowerCase() <= itens[indice - 1]!.os_id.toLowerCase());
  const acessoConfirmado = habilitado && !divergentes && !consulta.isFetching && !consulta.isError && !abertas.isFetching && !abertas.isError;
  return <section aria-label="Fotografia de OS vinculadas"><h4>OS vinculadas à revisão</h4>{!habilitado && <p>Diagnóstico mediado indisponível.</p>}{divergentes && <p role="alert">A lista mudou durante a consulta. <button type="button" onClick={() => void abertas.refetch()}>Atualizar lista</button></p>}<p>Fotografia parcial por ocorrências de calendário e ponte legada. Não inclui Visitas nem OS sem vínculo; não calcula impacto e não comprova ausência de impacto. Páginas podem mudar durante a consulta. Não autoriza aprovação.</p>{(consulta.isFetching || abertas.isFetching) && <p role="status">Verificando acesso e consultando OS…</p>}{consulta.isError && <p role="alert">Diagnóstico indisponível ou revisão alterada. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}{acessoConfirmado && consulta.data && <p>Ocorrências preparadas: {consulta.data.ocorrenciasCalendarioPreparadas} · sem ponte: {consulta.data.ocorrenciasSemPonte} · OS vinculadas: {consulta.data.osVinculadasMesmoCliente} · OS abertas: {consulta.data.osAbertasMesmoCliente} · divergências de Cliente: {consulta.data.osClienteDivergente}</p>}{abertas.isError && <p role="alert">Lista indisponível. <button type="button" onClick={() => void abertas.refetch()}>Tentar novamente</button></p>}{acessoConfirmado && abertas.data && <ul>{itens.map((os) => <li key={os.os_id}>OS {os.os_id} · {os.status} · ocorrência {os.ocorrencia_id} · Rotina {os.rotina_id} · vencimento {os.vencimento_original}</li>)}</ul>}{acessoConfirmado && abertas.hasNextPage && <button type="button" disabled={abertas.isFetching} onClick={() => void abertas.fetchNextPage()}>Mais OS</button>}</section>;
}
