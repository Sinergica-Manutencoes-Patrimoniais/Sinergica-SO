import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const resultado = z.object({ revisao: z.number().int().positive(), comprovante: z.enum(["nao_realizada", "indisponivel", "objeto_privado_existe"]),
  rateio: z.enum(["sem_rateio", "vinculo_incompleto", "vinculo_encerrado", "total_divergente", "total_confere"]), parcelas: z.number().int().nonnegative(),
  base: z.enum(["previsto", "realizado"]), valor_base_centavos: z.string().regex(/^\d+$/), total_rateado_centavos: z.string().regex(/^\d+$/) }).strict();
const comprovantes = { nao_realizada: "Despesa ainda não realizada", indisponivel: "Comprovante indisponível", objeto_privado_existe: "Objeto privado localizado" };
const rateios = { sem_rateio: "Sem rateio", vinculo_incompleto: "Rateio incompleto: vínculo não localizado", vinculo_encerrado: "Rateio possui vínculo encerrado ou incompatível", total_divergente: "Total do rateio diverge", total_confere: "Soma do rateio confere" };
export function ConferenciaDespesa({ userId, clienteId, visitaId, despesaId, revisao }: { userId: string; clienteId: string; visitaId: string; despesaId: string; revisao: number }) {
  const [aberto, setAberto] = useState(false);
  const consulta = useQuery({ queryKey: ["conferencia-despesa", userId, clienteId, visitaId, despesaId, revisao], enabled: aberto,
    gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: true, queryFn: async ({ signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_conferir_despesa_visita", {
        p_cliente_id: clienteId, p_visita_id: visitaId, p_despesa_id: despesaId }).abortSignal(signal);
      if (error) throw error; return z.array(resultado).length(1).parse(data)[0]!;
    } });
  if (import.meta.env.VITE_SSO_CONFERENCIA_DESPESA_ENABLED !== "true") return null;
  return <section><button type="button" onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar conferência" : "Conferir despesa"}</button>
    {aberto && consulta.isFetching && <p>Consultando…</p>}
    {aberto && consulta.isError && <p role="alert">Conferência indisponível ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {aberto && !consulta.isFetching && !consulta.isError && consulta.data && <div>
      {consulta.data.revisao !== revisao && <p role="alert">A despesa mudou desde a listagem; atualize antes de editar.</p>}
      <p>Revisão {consulta.data.revisao}: {comprovantes[consulta.data.comprovante]}; {rateios[consulta.data.rateio]} ({consulta.data.parcelas} parcela(s)).</p>
      <p>Base {consulta.data.base}: {consulta.data.valor_base_centavos} centavos; total das parcelas: {consulta.data.total_rateado_centavos} centavos.</p>
      <p>A soma não comprova conformidade integral. A presença do arquivo não valida seu conteúdo. Esta conferência não representa aprovação nem pagamento.</p>
    </div>}
  </section>;
}
