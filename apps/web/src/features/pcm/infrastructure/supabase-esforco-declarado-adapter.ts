import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const minutos = z.number().int().nonnegative().nullable();
const resposta = z.object({
  origemTipo: z.enum(["os", "ocorrencia", "ocorrencia_visita"]),
  origemId: z.string(),
  revision: z.number().int().nonnegative(),
  internosMinutos: minutos,
  terceirosMinutos: minutos,
  acompanhamentoMinutos: minutos,
});
export type Esforco = z.infer<typeof resposta>;
export type PedidoEsforco = Esforco & {
  clienteId: string;
  requestId: string;
  justificativa: string;
};

export async function consultarEsforcoDeclarado(
  clienteId: string,
  osId: string,
  signal: AbortSignal,
  origemTipo: Esforco["origemTipo"] = "os",
): Promise<Esforco> {
  const { data, error } = await supabase
    .schema("pcm")
    .rpc("sso_consultar_esforco_autorizado", {
      p_cliente_id: clienteId,
      p_origem_tipo: origemTipo,
      p_origem_id: osId,
    })
    .abortSignal(signal);
  if (error) throw error;
  const result = resposta.parse(data);
  if (result.origemId !== osId || result.origemTipo !== origemTipo) throw new Error("Origem divergente.");
  return result;
}
export async function declararEsforco(p: PedidoEsforco): Promise<void> {
  const { data, error } = await supabase.schema("pcm").rpc(p.origemTipo === "ocorrencia_visita" ? "sso_declarar_esforco_ocorrencia_visita" : "sso_mediar_declaracao_esforco", {
    p_request_id: p.requestId,
    p_cliente_id: p.clienteId,
    ...(p.origemTipo === "ocorrencia_visita" ? {} : { p_origem_tipo: p.origemTipo }),
    p_origem_id: p.origemId,
    p_expected_revision: p.revision,
    p_internos_minutos: p.internosMinutos,
    p_terceiros_minutos: p.terceirosMinutos,
    p_acompanhamento_minutos: p.acompanhamentoMinutos,
    p_justificativa: p.justificativa,
  });
  if (error) throw error;
  z.object({ requestId: z.literal(p.requestId), revision: z.literal(p.revision + 1) }).parse(data);
}
