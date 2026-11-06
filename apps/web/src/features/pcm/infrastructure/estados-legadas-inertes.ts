import { supabase } from "../../../lib/supabase-client";

type Estado = "normal" | "substituida";
/** Consulta completa por Cliente; resposta parcial ou fora do lote bloqueia a leitura. */
export async function consultarEstadosLegadas(clienteId: string, ids: readonly string[]): Promise<Map<string, Estado>> {
 const estados = new Map<string, Estado>();
 if (import.meta.env.VITE_SSO_RECONCILIAR_LEGADA_INERTE_ENABLED !== "true") return estados;
 for (let i=0;i<ids.length;i+=100) {
  const lote=ids.slice(i,i+100); const esperados=new Set(lote);
  if (esperados.size!==lote.length) throw new Error("Ocorrências duplicadas na consulta de reconciliação.");
  const {data,error}=await supabase.schema("pcm").rpc("sso_estados_legadas_inertes",{p_cliente:clienteId,p_legadas:lote});
  if(error||!Array.isArray(data)||data.length!==lote.length) throw new Error("Estado de reconciliação indisponível.");
  for(const row of data) {
   if(!row||typeof row.legada_id!=="string"||!esperados.delete(row.legada_id)||(row.estado!=="normal"&&row.estado!=="substituida")) throw new Error("Estado de reconciliação inconsistente.");
   estados.set(row.legada_id,row.estado);
  }
  if(esperados.size) throw new Error("Estado de reconciliação incompleto.");
 }
 return estados;
}
