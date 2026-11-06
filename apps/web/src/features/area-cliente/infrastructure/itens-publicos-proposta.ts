import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const item = z.object({ id: z.string().uuid(), descricao: z.string().min(1), quantidade: z.number().int().positive(),
  precoUnitarioCentavos: z.number().int().nonnegative().safe() }).strict();
const schema = z.object({ estruturado: z.boolean(), itens: z.array(item).max(100) }).strict()
  .refine((v) => v.estruturado ? v.itens.length > 0 : v.itens.length === 0);
export async function obterItensHistoricos(clienteId: string, osId: string, propostaId: string, versao: number, userId: string) {
  const parametros={p_cliente_id:clienteId,p_os_id:osId,p_proposta_id:propostaId,p_versao:versao};
  const requisicao=import.meta.env.VITE_SSO_ITENS_HISTORICOS_PORTAL_MEDIADOS_ENABLED==="true"
    ? supabase.schema("comercial").rpc("sso_portal_itens_historicos_mediados",{...parametros,p_ator_id:userId})
    : supabase.schema("comercial").rpc("sso_portal_itens_publicos_historico",parametros);
  const { data, error } = await requisicao;
  if (error) throw error; return schema.parse(data);
}
export function formatarItensHistoricos(dados: z.infer<typeof schema>) {
  return dados.estruturado ? `Itens públicos estruturados:\n${dados.itens.map((i) => `${i.descricao} — ${i.quantidade} × ${i.precoUnitarioCentavos} centavos`).join("\n")}` :
    "Esta versão anterior não possui snapshot estruturado de itens.";
}
