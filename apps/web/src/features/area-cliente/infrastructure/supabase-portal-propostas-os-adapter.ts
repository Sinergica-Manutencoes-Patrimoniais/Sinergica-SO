import { z } from "zod";
import { portalDecisaoOrcamentoSchema } from "@sinergica/shared";
import { supabase } from "../../../lib/supabase-client";

const proposta = z.object({ id: z.string().guid(), ordem_servico_id: z.string().guid(),
  status: z.enum(["enviada", "aceita", "recusada"]), versao: z.number().int().positive(),
  valido_ate: z.string().nullable(), payload: z.object({ proposta: z.object({
    tipo: z.string().optional(), escopo: z.string().optional(), preco_centavos: z.number().int().safe().optional(),
    valido_ate: z.string().optional(), versao_atual: z.number().int().optional(),
  }).strict(), itens: z.array(z.object({ descricao: z.string().optional(), quantidade: z.number().optional(),
    preco_venda_centavos: z.number().int().safe().optional() }).strict()) }).strict() }).strict();
export type PropostaOs = z.infer<typeof proposta>;
const pedido = portalDecisaoOrcamentoSchema;
export type DecidirPropostaOs = z.infer<typeof pedido>;
export const validarDecisaoPropostaOs = (v: unknown) => pedido.parse(v);
export async function conferirSessaoProposta(userId: string, signal?: AbortSignal) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
}
export async function listarPropostasOs(clienteId: string, osId: string, apos: string | null, signal?: AbortSignal, userId?: string) {
  if (userId) await conferirSessaoProposta(userId, signal);
  const parametros={p_cliente_id:clienteId,p_os_id:osId,p_apos:apos};
  const mediado=import.meta.env.VITE_SSO_PROPOSTAS_PORTAL_MEDIADAS_ENABLED==="true";
  if(mediado&&!userId)throw new Error("Usuário ausente.");
  let consulta = mediado?supabase.schema("comercial").rpc("sso_portal_propostas_os_mediada",{...parametros,p_ator_id:userId}):supabase.schema("comercial").rpc("sso_portal_propostas_os",parametros);
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta;
  if (error) throw error;
  const resultado = z.array(proposta).max(20).parse(data);
  let anterior = apos?.toLowerCase() ?? null;
  for (const item of resultado) {
    if (item.ordem_servico_id.toLowerCase() !== osId.toLowerCase() || (anterior !== null && item.id.toLowerCase() <= anterior)) throw new Error("Resposta inválida.");
    anterior = item.id.toLowerCase();
  }
  if (userId) await conferirSessaoProposta(userId, signal);
  return resultado;
}
export async function obterDetalheOperacional(clienteId: string, osId: string, propostaId: string, versao: number, userId: string) {
  const parametros={p_cliente_id:clienteId,p_os_id:osId,p_proposta_id:propostaId,p_versao:versao};
  const requisicao=import.meta.env.VITE_SSO_PROPOSTAS_PORTAL_MEDIADAS_ENABLED==="true"?supabase.schema("comercial").rpc("sso_portal_detalhe_operacional_mediado",{...parametros,p_ator_id:userId}):supabase.schema("comercial").rpc("sso_portal_detalhe_operacional",parametros);
  const { data, error } = await requisicao;
  if (error) throw error;
  const r = z.object({ propostaId: z.string().guid(), versao: z.number().int().positive(),
    ordemServicoId: z.string().guid(), payload: proposta.shape.payload }).strict().parse(data);
  if (r.propostaId !== propostaId || r.ordemServicoId !== osId || r.versao !== versao) throw new Error("Resposta inválida.");
  return r.payload;
}
export async function obterVersaoOperacional(clienteId: string, osId: string, propostaId: string, versao: number, userId: string) {
  const parametros={p_cliente_id:clienteId,p_os_id:osId,p_proposta_id:propostaId,p_versao:versao};
  const requisicao=import.meta.env.VITE_SSO_HISTORICO_PROPOSTA_MEDIADO_ENABLED==="true"
    ? supabase.schema("comercial").rpc("sso_portal_versao_operacional_mediada",{...parametros,p_ator_id:userId})
    : supabase.schema("comercial").rpc("sso_portal_versao_operacional",parametros);
  const { data, error } = await requisicao;
  if (error) throw error;
  const r = z.object({ propostaId: z.string().guid(), versao: z.number().int().positive(),
    ordemServicoId: z.string().guid(), payload: proposta.shape.payload }).strict().parse(data);
  if (r.propostaId !== propostaId || r.ordemServicoId !== osId || r.versao !== versao) throw new Error("Resposta inválida.");
  return r.payload;
}
export async function decidirPropostaOs(input: DecidirPropostaOs, userId?: string, contexto?: { clienteId:string; osId:string }) {
  const p = validarDecisaoPropostaOs(input);
  if (userId) await conferirSessaoProposta(userId);
  const parametros={p_request_id:p.requestId,p_proposta_id:p.propostaId,p_versao:p.versao,p_decisao:p.decisao,p_motivo:p.motivo};
  const mediada=import.meta.env.VITE_SSO_DECISAO_PROPOSTA_PORTAL_MEDIADA_ENABLED==="true";
  if(mediada&&(!userId||!contexto))throw new Error("Contexto indisponível.");
  const requisicao=mediada?supabase.schema("comercial").rpc("sso_portal_decidir_proposta_mediada",{...parametros,p_ator_id:userId,p_cliente_id:contexto!.clienteId,p_os_id:contexto!.osId}):supabase.schema("comercial").rpc("sso_portal_decidir_proposta_versionada",parametros);
  const { data, error } = await requisicao;
  if (error) throw error;
  if (!data || data.aggregateId !== p.propostaId || data.revision !== p.versao ||
    data.state !== p.decisao || data.requestId !== p.requestId) throw new Error("Resposta inválida.");
  if (userId) await conferirSessaoProposta(userId);
}
