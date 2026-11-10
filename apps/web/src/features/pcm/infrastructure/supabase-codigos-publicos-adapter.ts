import { supabase } from "../../../lib/supabase-client";

export type ResultadoCodigoPublico =
  | { situacao: "nao_encontrado" | "ambiguo" }
  | { situacao: "encontrado"; tipo: "sistema" | "componente"; ativoId: string };

export type SubstituicaoCodigo = {
  requestId: string;
  tipo: "sistema" | "componente" | "grupo_quantitativo";
  ativoId: string;
  codigoAnterior: string;
  codigoNovo: string;
  motivo: string;
};

export async function substituirCodigoPublico(pedido: SubstituicaoCodigo): Promise<void> {
  const consulta = pedido.tipo === "grupo_quantitativo" ? supabase.schema("pcm").rpc("sso_substituir_codigo_grupo", {
    p_request_id: pedido.requestId,
    p_grupo_id: pedido.ativoId,
    p_codigo_anterior: pedido.codigoAnterior,
    p_codigo_novo: pedido.codigoNovo,
    p_motivo: pedido.motivo,
  }) : supabase.schema("pcm").rpc("sso_substituir_codigo_publico", {
    p_request_id: pedido.requestId,
    p_tipo: pedido.tipo,
    p_ativo_id: pedido.ativoId,
    p_codigo_anterior: pedido.codigoAnterior,
    p_codigo_novo: pedido.codigoNovo,
    p_motivo: pedido.motivo,
  });
  const { data, error } = await consulta;
  if (error) throw error;
  if (
    !data ||
    data.requestId !== pedido.requestId ||
    data.ativoId !== pedido.ativoId ||
    data.tipo !== pedido.tipo ||
    data.codigoAtual !== pedido.codigoNovo ||
    typeof data.aliasId !== "string"
  )
    throw new Error("Resposta de substituição inválida.");
}

export async function localizarCodigoPublico(
  clienteId: string,
  codigo: string,
  userId: string,
  signal?: AbortSignal,
): Promise<ResultadoCodigoPublico> {
  if (!clienteId.trim() || !userId.trim() || !codigo.trim() || codigo.length > 200)
    throw new Error("Código ou Cliente inválido.");
  const parametros = { p_cliente_id: clienteId, p_codigo: codigo };
  const consulta = import.meta.env.VITE_SSO_BUSCA_CODIGO_MEDIADA_ENABLED === "true"
    ? supabase.schema("pcm").rpc("sso_localizar_codigo_publico_mediada", { ...parametros, p_ator_id: userId })
    : supabase.schema("pcm").rpc("sso_localizar_codigo_publico", parametros);
  const { data, error } = await (signal ? consulta.abortSignal(signal) : consulta);
  if (error) throw error;
  if (data?.situacao === "nao_encontrado" || data?.situacao === "ambiguo")
    return { situacao: data.situacao };
  if (
    data?.situacao === "encontrado" &&
    (data.tipo === "sistema" || data.tipo === "componente") &&
    typeof data.ativoId === "string" &&
    data.ativoId.trim()
  )
    return { situacao: "encontrado", tipo: data.tipo, ativoId: data.ativoId };
  throw new Error("Resposta de código inválida.");
}
