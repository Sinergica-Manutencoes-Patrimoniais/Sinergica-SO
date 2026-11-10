import { supabase } from "../../../lib/supabase-client";
import { z } from "zod";

const uuid = z.string().guid();
const revisaoPositiva = z.number().int().safe().positive();

export async function conferirToleranciasLote(usuario:string,clienteId:string,loteId:string,revisao:number,ids:string[],signal?:AbortSignal) {
  if (!Number.isSafeInteger(revisao) || revisao<1 || ids.length<1 || ids.length>25 || new Set(ids).size!==ids.length) throw new Error("Seleção inválida.");
  const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||signal?.aborted)throw new Error("Sessão alterada.");
  let query=supabase.schema("pcm").rpc("sso_conferir_tolerancias_lote",{p_ator_id:usuario,p_cliente_id:clienteId,p_lote_id:loteId,p_expected_revision:revisao,p_mapeamentos:ids});
  if(signal)query=query.abortSignal(signal);const {data,error}=await query;if(error)throw error;
  if(!Array.isArray(data)||data.length!==ids.length)throw new Error("Tolerâncias incompletas.");
  const vistos=new Set<string>();
  const linhas=data.map((x)=>{if(!x||typeof x.mapeamento_id!=="string"||!ids.includes(x.mapeamento_id)||vistos.has(x.mapeamento_id)||
    !Number.isSafeInteger(x.antes)||x.antes<0||!Number.isSafeInteger(x.depois)||x.depois<0||typeof x.configurada!=="boolean"||x.revision!==revisao)throw new Error("Tolerância divergente.");
    vistos.add(x.mapeamento_id);return {id:x.mapeamento_id as string,antes:x.antes as number,depois:x.depois as number,configurada:x.configurada as boolean};});
  const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||signal?.aborted)throw new Error("Sessão alterada.");return linhas;
}

export type PedidoLoteCronograma = { requestId: string; clienteId: string; loteId: string; loteRevision: number; planoId: string; planoRevision: number; linhas: { chave: string; rotinaId: string }[] };
export async function incorporarLoteCronograma(p: PedidoLoteCronograma) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_incorporar_lote_cronograma_mediado", { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_lote_id: p.loteId, p_expected_lote_revision: p.loteRevision, p_plano_id: p.planoId, p_expected_plano_revision: p.planoRevision, p_linhas: p.linhas });
  if (error) throw error;
  const resposta=z.object({aggregateId:uuid,revision:revisaoPositiva,state:z.literal("rascunho"),requestId:uuid,
    linhas:z.array(z.object({chave:z.string().min(1).max(200),rotinaId:uuid,requestId:uuid,revision:revisaoPositiva}).strict()).min(1).max(25)}).strict().parse(data);
  if(resposta.aggregateId!==p.planoId||resposta.requestId!==p.requestId||resposta.linhas.length!==p.linhas.length||
    resposta.revision!==p.planoRevision+p.linhas.length||new Set(resposta.linhas.map((x)=>x.requestId)).size!==resposta.linhas.length||
    resposta.linhas.some((x,i)=>x.chave!==p.linhas[i]?.chave||x.rotinaId!==p.linhas[i]?.rotinaId||x.revision!==p.planoRevision+i+1))throw new Error("Recibo de incorporação divergente.");
  return resposta;
}

export type PedidoPropostaReprocessamento = { requestId: string; clienteId: string; loteId: string; loteRevision: number; chave: string; planoId: string; planoRevision: number; justificativa: string };
export type PedidoAplicacaoReprocessamento = { requestId: string; clienteId: string; propostaId: string };
export async function proporReprocessamentoCronograma(p: PedidoPropostaReprocessamento) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_propor_reprocessamento_mediado", { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_lote_id: p.loteId, p_expected_lote_revision: p.loteRevision, p_chave: p.chave, p_plano_id: p.planoId, p_expected_plano_revision: p.planoRevision, p_justificativa: p.justificativa }); if (error) throw error; return data;
}
export async function aplicarReprocessamentoCronograma(p: PedidoAplicacaoReprocessamento) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_aplicar_reprocessamento_mediado", { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_proposta_id: p.propostaId }); if (error) throw error; return data;
}
export async function listarPropostasReprocessamento(clienteId: string, loteId: string, planoId: string, apos: string | null, signal?: AbortSignal) {
  let query = supabase.schema("pcm").rpc("sso_listar_reprocessamentos_mediado", { p_cliente_id: clienteId, p_lote_id: loteId, p_plano_id: planoId, p_apos: apos, p_limite: 20 });
  if (signal) query = query.abortSignal(signal); const { data, error } = await query; if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Propostas inválidas.");
  return data as { id: string; chave_linha: string; rotina_id: string; revisao_lote: number; revisao_plano: number; antes: Record<string, unknown>; depois: Record<string, unknown>; justificativa: string; criado_em: string; aplicada: boolean }[];
}

export type PedidoIncorporacaoCronograma = { requestId: string; clienteId: string; loteId: string; loteRevision: number; chave: string; planoId: string; planoRevision: number; rotinaId: string };
export async function incorporarLinhaCronograma(p: PedidoIncorporacaoCronograma) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_incorporar_linha_cronograma_mediado", { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_lote_id: p.loteId, p_expected_lote_revision: p.loteRevision, p_chave: p.chave, p_plano_id: p.planoId, p_expected_plano_revision: p.planoRevision, p_rotina_id: p.rotinaId });
  if (error) throw error;
  const resposta=z.object({aggregateId:uuid,revision:revisaoPositiva,state:z.literal("rascunho"),rotinaId:uuid,origemId:uuid,aprovacaoId:uuid,requestId:uuid,warnings:z.array(z.string())}).strict().parse(data);
  if(resposta.aggregateId!==p.planoId||resposta.requestId!==p.requestId||resposta.rotinaId!==p.rotinaId||resposta.revision!==p.planoRevision+1)throw new Error("Recibo de incorporação divergente.");
  return resposta;
}
export async function prepararImportacaoCronograma(clienteId: string, loteId: string, planoId: string, apos: string | null, signal?: AbortSignal) {
  let query = supabase.schema("pcm").rpc("sso_preparar_importacao_mediada", { p_cliente_id: clienteId, p_lote_id: loteId, p_plano_id: planoId, p_apos: apos, p_limite: 20 });
  if (signal) query = query.abortSignal(signal); const { data, error } = await query; if (error) throw error;
  return z.array(z.object({ chave: z.string().min(1).max(200), candidata: z.boolean(), identidade: z.string().nullable(), mapeamento_id: uuid.nullable(), alvo_atual: z.string(), pendencias: z.array(z.string()), revisao_lote: revisaoPositiva, revisao_plano: revisaoPositiva, aprovacao_id: uuid }).strict()).max(20).parse(data);
}

export type PedidoToleranciaCronograma = { requestId: string; loteId: string; expectedRevision: number; chave: string; mapeamentoId: string; antes: number; depois: number };
export async function salvarToleranciaCronograma(p: PedidoToleranciaCronograma) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_tolerancia_cronograma_mediada", { p_request_id: p.requestId, p_lote_id: p.loteId, p_expected_revision: p.expectedRevision, p_chave: p.chave, p_mapeamento_id: p.mapeamentoId, p_antes: p.antes, p_depois: p.depois });
  if (error) throw error; return data;
}
export async function obterToleranciaCronograma(clienteId: string, loteId: string, mapeamentoId: string, signal?: AbortSignal) {
  let query = supabase.schema("pcm").rpc("sso_obter_tolerancia_mediada", { p_cliente_id: clienteId, p_lote_id: loteId, p_mapeamento_id: mapeamentoId });
  if (signal) query = query.abortSignal(signal); const { data, error } = await query; if (error) throw error;
  if (!data || !Number.isInteger(data.antes) || !Number.isInteger(data.depois) || typeof data.configurada !== "boolean") throw new Error("Tolerância inválida.");
  return data as { antes: number; depois: number; configurada: boolean };
}

export type PedidoAprovacaoCronograma = { requestId: string; clienteId: string; loteId: string; expectedRevision: number; justificativa: string };
export async function aprovarCronogramaStaging(p: PedidoAprovacaoCronograma) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_aprovar_cronograma_mediado", { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_lote_id: p.loteId, p_expected_revision: p.expectedRevision, p_justificativa: p.justificativa });
  if (error) throw error; return data;
}

export async function conferirLinhasCronograma(clienteId: string, loteId: string, apos: string | null, signal?: AbortSignal) {
  let query = supabase.schema("pcm").rpc("sso_conferir_cronograma_mediado", { p_cliente_id: clienteId, p_lote_id: loteId, p_apos: apos, p_limite: 20 });
  if (signal) query = query.abortSignal(signal); const { data, error } = await query; if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Conferência inválida.");
  return data as { chave: string; tipo_linha: string | null; conferencia: string | null; identidade: string | null; mapeamento_id: string | null; situacao: string | null; pendencias: string[]; alvo_atual: string }[];
}

export type PedidoClassificacaoCronograma = { requestId: string; loteId: string; expectedRevision: number; chave: string; tipo: "cabecalho" | "dado" | "ignorada"; conferencia: "pendente" | "concluida"; justificativa: string };
export async function classificarLinhaCronograma(p: PedidoClassificacaoCronograma) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_classificar_cronograma_mediado", { p_request_id: p.requestId, p_lote_id: p.loteId, p_expected_revision: p.expectedRevision, p_chave_linha: p.chave, p_tipo: p.tipo, p_conferencia: p.conferencia, p_justificativa: p.justificativa });
  if (error) throw error; return data;
}
export async function diagnosticarCronograma(clienteId: string, loteId: string, signal?: AbortSignal) {
  let query = supabase.schema("pcm").rpc("sso_diagnosticar_cronograma_mediado", { p_cliente_id: clienteId, p_lote_id: loteId });
  if (signal) query = query.abortSignal(signal); const { data, error } = await query; if (error) throw error;
  if (!data || data.loteId !== loteId || data.aprovacaoDisponivel !== false || !Array.isArray(data.impedimentos)) throw new Error("Diagnóstico inválido.");
  return data as { revision: number; linhasBrutas: number; linhasClassificadas: number; cabecalhosDeclarados: number; dadosDeclarados: number; ignoradasDeclaradas: number; conferenciasConcluidas: number; linhasComIdentidade: number; linhasComMapeamento: number; linhasRejeitadas: number; linhasEmRevisao: number; impedimentos: string[] };
}

export type PedidoRevisaoLinhaCronograma = { requestId: string; loteId: string; expectedRevision: number; chaveLinha: string; estado: "em_revisao" | "rejeitada"; justificativa: string };
export async function revisarLinhaCronograma(p: PedidoRevisaoLinhaCronograma) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_revisar_cronograma_mediado", { p_request_id: p.requestId, p_lote_id: p.loteId, p_expected_revision: p.expectedRevision, p_chave_linha: p.chaveLinha, p_estado: p.estado, p_justificativa: p.justificativa });
  if (error) throw error;
  return data;
}
export async function listarRevisoesLinhaCronograma(clienteId: string, loteId: string, chave: string, apos: number | null, signal?: AbortSignal) {
  let query = supabase.schema("pcm").rpc("sso_listar_revisoes_cronograma_mediado", { p_cliente_id: clienteId, p_lote_id: loteId, p_chave_linha: chave, p_apos: apos, p_limite: 20 });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Histórico inválido.");
  return data as { id: string; revisao_lote: number; estado: string; justificativa: string; ator_id: string; criado_em: string }[];
}

export type PedidoIdentidadeCronograma = { requestId: string; loteId: string; expectedRevision: number; chaveLinha: string; identidade: string };
export async function identificarLinhaCronograma(p: PedidoIdentidadeCronograma) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_identificar_cronograma_mediado", {
    p_request_id: p.requestId, p_lote_id: p.loteId, p_expected_revision: p.expectedRevision,
    p_chave_linha: p.chaveLinha, p_identidade: p.identidade,
  });
  if (error) throw error;
  return data;
}
export async function compararIdentidadesCronograma(clienteId: string, anterior: string, novo: string, apos: string | null, signal?: AbortSignal) {
  let query = supabase.schema("pcm").rpc("sso_comparar_cronogramas_mediado", {
    p_cliente_id: clienteId, p_anterior: anterior, p_novo: novo, p_apos: apos, p_limite: 20,
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Comparação inválida.");
  return data as { identidade: string; chave_anterior: string | null; chave_nova: string | null; estado: string }[];
}

export type PedidoMatriz = {
  requestId: string;
  loteId: string;
  clienteId: string;
  fonteId: string;
  matriz: unknown[][];
};
export type PedidoRevisao = {
  requestId: string;
  loteId: string;
  expectedRevision: number;
  numeroLinha: number;
  observacao: string;
};

export type PedidoMapeamento = {
  requestId: string; loteId: string; expectedRevision: number; numeroLinha: number;
  disciplina: string; nomeRotina: string; alvoTipo: "sistema" | "componente" | "grupo";
  alvoId: string; modo: "calendario" | "visita"; intervalo: number;
  unidade: "dias" | "semanas" | "meses" | "anos"; dataBase: string | null;
  tempoMinutos: number | null; premissaMensal: "nao_aplicavel" | "calendario_real" | "quatro_semanas";
};

export async function mapearLinhaCronograma(p: PedidoMapeamento) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_mapear_cronograma_mediado", {
    p_request_id: p.requestId, p_lote_id: p.loteId, p_expected_revision: p.expectedRevision,
    p_numero_linha: p.numeroLinha, p_disciplina: p.disciplina, p_nome_rotina: p.nomeRotina,
    p_alvo_tipo: p.alvoTipo, p_alvo_id: p.alvoId, p_modo: p.modo, p_intervalo: p.intervalo,
    p_unidade: p.unidade, p_data_base: p.dataBase, p_tempo_minutos: p.tempoMinutos,
    p_premissa_mensal: p.premissaMensal,
  });
  if (error) throw error;
  if (!data || data.aggregateId !== p.loteId || data.requestId !== p.requestId ||
    data.revision !== p.expectedRevision + 1 || data.state !== "pendente")
    throw new Error("Resposta de mapeamento inválida.");
}

export async function listarMapeamentosCronograma(clienteId: string, loteId: string, apos: string | null, signal?: AbortSignal) {
  let query = supabase.schema("pcm").rpc("sso_listar_mapeamentos_mediado", {
    p_cliente_id: clienteId, p_lote_id: loteId, p_apos: apos, p_limite: 50,
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Resposta de mapeamentos inválida.");
  return data.map((linha) => {
    if (typeof linha.id !== "string" || typeof linha.chave_linha !== "string" || typeof linha.disciplina !== "string" ||
      typeof linha.nome_rotina !== "string" || typeof linha.alvo_tipo !== "string" ||
      typeof linha.alvo_id !== "string" || typeof linha.modo !== "string" ||
      !Number.isSafeInteger(linha.revisao_lote) || !Number.isSafeInteger(linha.intervalo_n) || linha.intervalo_n < 1 ||
      !["dias", "semanas", "meses", "anos"].includes(linha.intervalo_unidade) ||
      (linha.data_base !== null && (typeof linha.data_base !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(linha.data_base))) ||
      (linha.tempo_minutos !== null && (!Number.isSafeInteger(linha.tempo_minutos) || linha.tempo_minutos < 1)) ||
      !["nao_aplicavel", "calendario_real", "quatro_semanas"].includes(linha.premissa_mensal_quatro_semanas)) throw new Error("Mapeamento inválido.");
    return { id: linha.id as string, chave: linha.chave_linha as string, disciplina: linha.disciplina as string,
      nome: linha.nome_rotina as string, alvoTipo: linha.alvo_tipo as string, alvoId: linha.alvo_id as string,
      modo: linha.modo as string, revisao: linha.revisao_lote as number, intervalo: linha.intervalo_n as number,
      unidade: linha.intervalo_unidade as string, dataBase: linha.data_base as string | null,
      tempoMinutos: linha.tempo_minutos as number | null, premissaMensal: linha.premissa_mensal_quatro_semanas as string };
  });
}

export async function listarAlvosCronograma(clienteId: string, tipo: PedidoMapeamento["alvoTipo"], busca: string, apos: string | null, signal?: AbortSignal) {
  let query = supabase.schema("pcm").rpc("sso_listar_alvos_cronograma_mediado", {
    p_cliente_id: clienteId, p_tipo: tipo, p_apos: apos, p_busca: busca, p_limite: 50,
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Resposta de alvos inválida.");
  return data.map((item) => {
    if (typeof item.id !== "string" || typeof item.nome !== "string") throw new Error("Alvo inválido.");
    return { id: item.id as string, nome: item.nome as string };
  });
}

export async function receberMatrizCronograma(p: PedidoMatriz) {
  const { data, error } = await supabase
    .schema("pcm")
    .rpc("sso_receber_cronograma_mediado", {
      p_request: p.requestId,
      p_lote: p.loteId,
      p_cliente: p.clienteId,
      p_fonte: p.fonteId,
      p_matriz: p.matriz,
    });
  if (error) throw error;
  if (
    !data ||
    data.aggregateId !== p.loteId ||
    data.requestId !== p.requestId ||
    data.state !== "pendente" ||
    !Number.isSafeInteger(data.revision)
  )
    throw new Error("Resposta de recepção inválida.");
}

export async function anotarRevisaoCronograma(p: PedidoRevisao) {
  const { data, error } = await supabase
    .schema("pcm")
    .rpc("sso_anotar_cronograma_mediado", {
      p_request: p.requestId,
      p_lote: p.loteId,
      p_revision: p.expectedRevision,
      p_linha: p.numeroLinha,
      p_observacao: p.observacao,
    });
  if (error) throw error;
  if (
    !data ||
    data.aggregateId !== p.loteId ||
    data.requestId !== p.requestId ||
    data.revision !== p.expectedRevision + 1 ||
    data.state !== "pendente"
  )
    throw new Error("Resposta de revisão inválida.");
}

export async function listarCronogramasStaging(
  clienteId: string,
  apos: string | null,
  signal?: AbortSignal,
) {
  let consulta = supabase
    .schema("pcm")
    .rpc("sso_listar_cronogramas_mediado", { p_cliente: clienteId, p_apos: apos, p_limite: 20 });
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta;
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Resposta de lotes inválida.");
  return data.map((row) => {
    if (
      typeof row.id !== "string" ||
      typeof row.fonte_id !== "string" ||
      !Number.isSafeInteger(row.revisao) ||
      row.revisao < 1 ||
      typeof row.criado_em !== "string"
    )
      throw new Error("Lote inválido.");
    return {
      id: row.id as string,
      fonte: row.fonte_id as string,
      revisao: row.revisao as number,
      criadoEm: row.criado_em as string,
    };
  });
}

export async function obterCronogramaStaging(
  clienteId: string,
  loteId: string,
  signal?: AbortSignal,
) {
  let consulta = supabase
    .schema("pcm")
    .rpc("sso_obter_cronograma_mediado", { p_cliente: clienteId, p_lote: loteId });
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta;
  if (error) throw error;
  if (
    !data ||
    data.id !== loteId ||
    data.clienteId !== clienteId ||
    typeof data.fonteId !== "string" ||
    !Number.isSafeInteger(data.revision) ||
    !Array.isArray(data.matriz) ||
    !data.matriz.every(Array.isArray)
  )
    throw new Error("Lote inválido.");
  return {
    fonteId: data.fonteId as string,
    revision: data.revision as number,
    matriz: data.matriz as unknown[][],
  };
}
