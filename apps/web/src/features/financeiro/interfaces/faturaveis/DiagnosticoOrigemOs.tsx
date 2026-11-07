import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const resposta = z.object({ osId: z.string().guid(), statusLocal: z.string(), categoriaLocal: z.string(), retornosComUltimaDecisaoAprovada: z.number().int().nonnegative(), propostasAceitasLocais: z.number().int().nonnegative(), servicoExtra: z.literal("nao_comprovado"), valorFaturavel: z.literal("nao_comprovado"), permiteCriarCandidato: z.literal(false) }).strict();
export function DiagnosticoOrigemOs({ cliente }: { cliente: string }) {
  const [osId, setOsId] = useState(""); const [ocupado, setOcupado] = useState(false); const [mensagem, setMensagem] = useState("");
  const consultar = async () => { if (ocupado || !z.string().guid().safeParse(osId).success) { setMensagem("Informe um identificador de OS válido."); return; } setOcupado(true); setMensagem(""); try { const { data, error } = await supabase.schema("financeiro").rpc("sso_diagnostico_origem_os_faturavel", { p_cliente_id: cliente, p_os_id: osId }); if (error) throw error; const r = resposta.parse(data); if (r.osId !== osId) throw new Error("OS divergente"); setMensagem(`Estado local: ${r.statusLocal}; categoria: ${r.categoriaLocal}; retornos com última decisão aprovada: ${r.retornosComUltimaDecisaoAprovada}; propostas aceitas locais: ${r.propostasAceitasLocais}.`); } catch { setMensagem("Diagnóstico indisponível ou sem acesso."); } finally { setOcupado(false); } };
  return <section aria-label="Diagnóstico de origem de OS"><h3>Diagnóstico de origem de OS</h3><p>Dados locais não comprovam serviço extra, valor faturável ou direito de cobrança. Esta consulta não cria candidato.</p><label>Identificador da OS <input value={osId} onChange={(e) => setOsId(e.target.value)} /></label><button type="button" disabled={ocupado} onClick={() => void consultar()}>Consultar</button>{mensagem && <p role="status">{mensagem}</p>}</section>;
}
