import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const resposta = z.object({ itemId: z.string().uuid(), revisao: z.number().int().positive(), autorizacaoInterna: z.boolean(), regraContratual: z.literal("nao_comprovada"), aceiteAdicional: z.literal("nao_comprovado"), autorizaConferencia: z.literal(false) }).strict();
export function DiagnosticoAceiteComplemento({ usuario, cliente, itemId }: { usuario: string; cliente: string; itemId: string }) {
  const [aberto, setAberto] = useState(false);
  const consulta = useQuery({ queryKey: ["faturavel-diagnostico-aceite", usuario, cliente, itemId], enabled: aberto, gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("financeiro").rpc("sso_diagnostico_aceite_complemento", { p_cliente_id: cliente, p_item_id: itemId }).abortSignal(signal); if (error) throw error; const r = resposta.parse(data); if (r.itemId !== itemId) throw new Error("Item divergente"); return r; } });
  return <section aria-label="Diagnóstico contratual do complemento"><button type="button" onClick={() => setAberto(!aberto)}>{aberto ? "Ocultar diagnóstico contratual" : "Consultar diagnóstico de complemento"}</button>
    {aberto && <><p>Uma autorização interna e o aceite da proposta original não comprovam a regra contratual nem o aceite do valor adicional. É necessário comprovar a regra aplicável e, quando exigido, o aceite específico.</p>
      {consulta.isFetching && <output>Consultando diagnóstico...</output>}{consulta.isError && <p role="alert">Diagnóstico indisponível, sem permissão ou item não elegível para esta consulta. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
      {consulta.data && !consulta.isFetching && !consulta.isError && <p>Revisão {consulta.data.revisao} · autorização interna {consulta.data.autorizacaoInterna ? "registrada" : "não registrada"} · regra contratual não comprovada · aceite adicional não comprovado · conferência não autorizada por esta consulta.</p>}</>}
  </section>;
}
