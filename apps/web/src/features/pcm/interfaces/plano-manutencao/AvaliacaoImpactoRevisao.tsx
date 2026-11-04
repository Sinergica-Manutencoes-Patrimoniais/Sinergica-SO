import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";
import { z } from "zod";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

const contagem = z.number().int().nonnegative().safe();

export function AvaliacaoImpactoRevisao({ userId, clienteId, planoId, revisao }: { userId: string; clienteId: string; planoId: string; revisao: number }) {
  const habilitado = import.meta.env.VITE_SSO_DIAGNOSTICOS_REVISAO_MEDIADOS_ENABLED === "true";
  const consulta = useQuery({ queryKey: ["avaliacao-impacto-revisao", userId, clienteId, planoId, revisao], enabled: habilitado, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_avaliar_impacto_revisao_mediado", { p_ator_id: userId, p_cliente_id: clienteId, p_plano_id: planoId, p_expected_plano: revisao, p_tipo: "calendario" }).abortSignal(signal);
      if (error) throw error;
      const r = z.object({ revisaoPlano: z.number().int().positive(), ocorrenciasCalendarioObservadas: contagem, decisoesAusentes: contagem, decisoesObsoletas: contagem, exigemReconciliacao: contagem, fontesIndividuaisIncompletas: contagem, comOsClienteDivergente: contagem, coberturaVisitasELegadoIndeterminada: z.literal(true), impactoIntegralComprovado: z.literal(false), aprovacaoAutorizada: z.literal(false) }).passthrough().parse(data);
      if (r.revisaoPlano !== revisao) throw new Error("Revisão divergente.");
      await conferirSessaoDiagnostico(userId, signal); return r;
    } });
  const visitas = useQuery({ queryKey: ["avaliacao-impacto-visita-legado", userId, clienteId, planoId, revisao], enabled: habilitado && import.meta.env.VITE_SSO_AVALIACAO_IMPACTO_VISITA_ENABLED === "true", gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_avaliar_impacto_revisao_mediado", { p_ator_id: userId, p_cliente_id: clienteId, p_plano_id: planoId, p_expected_plano: revisao, p_tipo: "visita_legado" }).abortSignal(signal);
      if (error) throw error;
      const r = z.object({ revisaoPlano: z.number().int().positive(), visitasPreparadasVersaoAnterior: contagem, visitasSemIdentidade: contagem.optional(), decisoesVisitaAusentes: contagem.optional(), decisoesVisitaObsoletas: contagem.optional(), visitasExigemReconciliacao: contagem.optional(), planosLegadosComRelacaoDeclarada: contagem, planosClienteSemRelacaoDeclarada: contagem, legadasSemPonteObservada: contagem, fontesCompletas: z.literal(false), impactoIntegralComprovado: z.literal(false), aprovacaoAutorizada: z.literal(false), relacaoNaoComprovaEquivalencia: z.literal(true) }).passthrough().parse(data);
      if (r.revisaoPlano !== revisao) throw new Error("Revisão divergente.");
      await conferirSessaoDiagnostico(userId, signal); return r;
    } });
  const grupos = useQuery({ queryKey: ["avaliacao-fotografias-grupo", userId, clienteId, planoId, revisao], enabled: habilitado && import.meta.env.VITE_SSO_DECISOES_IMPACTO_MEDIADAS_ENABLED === "true", gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_avaliar_fotografias_grupo_mediada", { p_ator_id: userId, p_cliente_id: clienteId, p_plano_id: planoId, p_expected_plano: revisao }).abortSignal(signal);
      if (error) throw error;
      const r = z.object({ revisaoPlano: z.number().int().positive(), ocorrenciasObservadas: contagem, fotografiasAusentes: contagem, fotografiasObsoletas: contagem, ocorrenciasComGrupo: contagem, ocorrenciasComOsAssociada: contagem, fontesCompletas: z.literal(false), aprovacaoAutorizada: z.literal(false) }).strict().parse(data);
      if (r.revisaoPlano !== revisao || r.fotografiasAusentes > r.ocorrenciasObservadas || r.fotografiasObsoletas > r.ocorrenciasObservadas) throw new Error("Resposta divergente.");
      await conferirSessaoDiagnostico(userId, signal); return r;
    } });
  const dadosDisponiveis = !consulta.isFetching && !consulta.isError && !visitas.isFetching && !visitas.isError;
  return <section aria-label="Avaliação parcial das decisões de impacto"><h5>Decisões de impacto por ocorrência</h5>{!habilitado && <p>Diagnóstico mediado indisponível.</p>}<p>Avaliação parcial de ocorrências preparadas por calendário. Visitas e outras fontes legadas permanecem indeterminadas; mesmo todas as contagens zeradas não liberam aprovação.</p>{(consulta.isFetching || visitas.isFetching) && <p role="status">Verificando acesso e impactos...</p>}{consulta.isError && <p role="alert">Avaliação indisponível ou revisão alterada. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}{dadosDisponiveis && consulta.data && <p>Ocorrências observadas {consulta.data.ocorrenciasCalendarioObservadas} · decisões ausentes {consulta.data.decisoesAusentes} · obsoletas {consulta.data.decisoesObsoletas} · exigem reconciliação {consulta.data.exigemReconciliacao} · fontes incompletas {consulta.data.fontesIndividuaisIncompletas} · divergências de Cliente {consulta.data.comOsClienteDivergente}.</p>}{visitas.isError && <p role="alert">Avaliação de Visitas/legado indisponível. <button type="button" onClick={() => void visitas.refetch()}>Tentar novamente</button></p>}{dadosDisponiveis && visitas.data && <p>Visitas preparadas {visitas.data.visitasPreparadasVersaoAnterior} · sem identidade {visitas.data.visitasSemIdentidade ?? "indeterminado"} · decisões ausentes {visitas.data.decisoesVisitaAusentes ?? "indeterminado"} · obsoletas {visitas.data.decisoesVisitaObsoletas ?? "indeterminado"} · exigem reconciliação {visitas.data.visitasExigemReconciliacao ?? "indeterminado"} · Planos legados declarados {visitas.data.planosLegadosComRelacaoDeclarada} · Planos do Cliente sem relação {visitas.data.planosClienteSemRelacaoDeclarada} · ocorrências legadas relacionadas sem ponte {visitas.data.legadasSemPonteObservada}. Ausência de relação não indica que o Plano legado pertence a este Plano.</p>}{grupos.isFetching && <p role="status">Verificando vínculos de Grupo e OS...</p>}{grupos.isError && <p role="alert">Avaliação de vínculos indisponível. <button type="button" onClick={() => void grupos.refetch()}>Tentar novamente</button></p>}{!grupos.isFetching && !grupos.isError && grupos.data && <p>Ocorrências observadas {grupos.data.ocorrenciasObservadas} · com Grupo {grupos.data.ocorrenciasComGrupo} · com OS vinculada {grupos.data.ocorrenciasComOsAssociada} · fotografias ausentes {grupos.data.fotografiasAusentes} · desatualizadas {grupos.data.fotografiasObsoletas}. Outras fontes ainda precisam de conferência.</p>}</section>;
}
