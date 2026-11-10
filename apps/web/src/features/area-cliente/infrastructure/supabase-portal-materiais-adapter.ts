import { z } from "zod";
import { portalInformarMaterialSchema, portalListaMateriaisSchema } from "@sinergica/shared";
import { supabase } from "../../../lib/supabase-client";

const lista = portalListaMateriaisSchema;
export type ListaPortal = z.infer<typeof lista>;
const pedidoSchema = portalInformarMaterialSchema;
export type PedidoDisponibilidade = z.infer<typeof pedidoSchema>;
export const validarPedidoDisponibilidade = (input: unknown) => pedidoSchema.parse(input);

export async function conferirSessaoMateriais(userId: string, signal?: AbortSignal) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
}

export async function listarMateriaisPortal(clienteId: string, osId: string, apos: string | null, signal?: AbortSignal, userId?: string) {
  const mediada = import.meta.env.VITE_SSO_MATERIAIS_ATUAIS_PORTAL_MEDIADOS_ENABLED === "true";
  if (mediada && !userId) throw new Error("Sessão necessária.");
  if (userId) await conferirSessaoMateriais(userId, signal);
  const parametros = { p_cliente_id: clienteId, p_os_id: osId, p_apos: apos };
  let consulta = mediada
    ? supabase.schema("pcm").rpc("sso_portal_listar_materiais_mediada", { ...parametros, p_ator_id: userId })
    : supabase.schema("pcm").rpc("sso_portal_listar_materiais", parametros);
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta;
  if (error) throw error;
  const resultado = z.array(lista).max(20).parse(data);
  let anterior = apos?.toLowerCase() ?? null;
  for (const item of resultado) {
    if (item.ordem_servico_id.toLowerCase() !== osId.toLowerCase() || (anterior !== null && item.id.toLowerCase() <= anterior)) {
      throw new Error("Resposta inválida.");
    }
    anterior = item.id.toLowerCase();
  }
  if (userId) await conferirSessaoMateriais(userId, signal);
  return resultado;
}
export async function informarDisponibilidadePortal(input: PedidoDisponibilidade, userId?: string, contexto?: { clienteId: string; osId: string }) {
  const p = validarPedidoDisponibilidade(input);
  const mediada = import.meta.env.VITE_SSO_DISPONIBILIDADE_MATERIAIS_PORTAL_MEDIADA_ENABLED === "true";
  if (mediada && (!userId || !contexto)) throw new Error("Sessão e contexto necessários.");
  if (userId) await conferirSessaoMateriais(userId);
  const parametros = {
    p_request_id: p.requestId, p_lista_id: p.listaId, p_expected_revision: p.expectedRevision, p_situacao: p.situacao,
  };
  const { data, error } = await (mediada
    ? supabase.schema("pcm").rpc("sso_portal_informar_material_mediado", {
      ...parametros, p_ator_id: userId, p_cliente_id: contexto?.clienteId, p_os_id: contexto?.osId,
    })
    : supabase.schema("pcm").rpc("sso_portal_informar_material", parametros));
  if (error) throw error;
  if (!data || data.requestId !== p.requestId || data.aggregateId !== p.listaId ||
    data.revision !== p.expectedRevision + 1 || data.state !== p.situacao) throw new Error("Resposta inválida.");
  if (userId) await conferirSessaoMateriais(userId);
}

export async function consultarReciboDisponibilidadePortal(input: PedidoDisponibilidade, userId: string, clienteId: string, osId: string) {
  const p = validarPedidoDisponibilidade(input);
  await conferirSessaoMateriais(userId);
  const { data, error } = await supabase.schema("pcm").rpc("sso_portal_recibo_disponibilidade_material", {
    p_ator_id: userId, p_cliente_id: clienteId, p_os_id: osId, p_request_id: p.requestId,
    p_lista_id: p.listaId, p_expected_revision: p.expectedRevision, p_situacao: p.situacao,
  });
  if (error) throw error;
  if (!data || data.requestId !== p.requestId || data.aggregateId !== p.listaId ||
    data.revision !== p.expectedRevision + 1 || data.state !== p.situacao) throw new Error("Resposta inválida.");
  await conferirSessaoMateriais(userId);
}
