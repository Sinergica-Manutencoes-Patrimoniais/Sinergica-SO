import { supabase } from "../../../lib/supabase-client";
import type {
  AvaliacaoPreventiva,
  CatalogoPreventivas,
  OcorrenciaPreventiva,
  PlanoPreventivo,
  ResultadoPreventivas,
} from "../application/preventivas-gateway";

export type ContextoPreventivas = { clienteId?: string };

function lancarSeErro(resultado: { error: unknown }) {
  if (resultado.error) throw resultado.error;
}

/**
 * Faz a filtragem no servidor e preserva a cadeia plano -> ocorrência -> avaliação.
 * Nunca é permitido buscar ocorrências ou avaliações sem os IDs já autorizados do plano.
 */
export async function listarPreventivas(
  contexto: ContextoPreventivas = {},
): Promise<ResultadoPreventivas> {
  let planosQuery = supabase.schema("pcm").from("planos_preventivos").select("*");
  if (contexto.clienteId) planosQuery = planosQuery.eq("cliente_id", contexto.clienteId);
  const planosResultado = await planosQuery.order("primeira_data");
  lancarSeErro(planosResultado);
  const planos = (planosResultado.data ?? []) as PlanoPreventivo[];
  const planoIds = planos.map((plano) => plano.id);
  if (planoIds.length === 0) return { planos: [], ocorrencias: [], avaliacoes: [] };

  const ocorrenciasResultado = await supabase
    .schema("pcm")
    .from("ocorrencias_preventivas")
    .select("*")
    .in("plano_id", planoIds)
    .order("vencimento");
  lancarSeErro(ocorrenciasResultado);
  const ocorrencias = (ocorrenciasResultado.data ?? []) as OcorrenciaPreventiva[];
  const ocorrenciaIds = ocorrencias.map((ocorrencia) => ocorrencia.id);
  if (ocorrenciaIds.length === 0) return { planos, ocorrencias: [], avaliacoes: [] };

  const [avaliacoesResultado, osResultado] = await Promise.all([
    supabase
      .schema("pcm")
      .from("avaliacoes_preventivas")
      .select("*")
      .in("ocorrencia_id", ocorrenciaIds)
      .order("recebido_em", { ascending: false })
      .limit(30),
    supabase
      .schema("pcm")
      .from("ordens_servico")
      .select("ocorrencia_preventiva_id,status")
      .in("ocorrencia_preventiva_id", ocorrenciaIds)
      .order("updated_at", { ascending: false }),
  ]);
  lancarSeErro(avaliacoesResultado);
  lancarSeErro(osResultado);
  const statusPorOcorrencia = new Map(
    (osResultado.data ?? []).map((ordem) => [ordem.ocorrencia_preventiva_id, ordem.status]),
  );
  return {
    planos,
    ocorrencias: ocorrencias.map((ocorrencia) => ({
      ...ocorrencia,
      os_status: statusPorOcorrencia.get(ocorrencia.id) ?? null,
    })),
    avaliacoes: (avaliacoesResultado.data ?? []) as AvaliacaoPreventiva[],
  };
}

/** Catálogos são carregados apenas ao abrir o formulário; no 360 o alvo já nasce filtrado. */
export async function listarCatalogoPreventivas(
  contexto: ContextoPreventivas = {},
): Promise<CatalogoPreventivas> {
  const sistemasBase = supabase
    .schema("pcm")
    .from("sistemas")
    .select("id,nome,cliente_id")
    .is("deleted_at", null)
    .eq("ativo", true);
  const equipamentosBase = supabase
    .schema("pcm")
    .from("equipamentos")
    .select("id,nome,client_id")
    .is("deleted_at", null)
    .eq("ativo", true);
  const [clientes, sistemas, equipamentos, questionarios, tipos, tecnicos] = await Promise.all([
    contexto.clienteId
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .schema("pcm")
          .from("clientes")
          .select("id,nome")
          .is("deleted_at", null)
          .order("nome"),
    (contexto.clienteId ? sistemasBase.eq("cliente_id", contexto.clienteId) : sistemasBase).order(
      "nome",
    ),
    (contexto.clienteId
      ? equipamentosBase.eq("client_id", contexto.clienteId)
      : equipamentosBase
    ).order("nome"),
    supabase.schema("pcm").from("questionarios").select("id,nome").eq("ativo", true).order("nome"),
    supabase
      .schema("pcm")
      .from("tipos_tarefa")
      .select("id,nome")
      .is("deleted_at", null)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .schema("pcm")
      .from("funcionarios")
      .select("id,nome,auvo_user_id")
      .is("deleted_at", null)
      .eq("ativo", true)
      .order("nome"),
  ]);
  [clientes, sistemas, equipamentos, questionarios, tipos, tecnicos].forEach(lancarSeErro);
  return {
    clientes: clientes.data ?? [],
    sistemas: sistemas.data ?? [],
    equipamentos: equipamentos.data ?? [],
    questionarios: questionarios.data ?? [],
    tipos: tipos.data ?? [],
    tecnicos: tecnicos.data ?? [],
  } as CatalogoPreventivas;
}
