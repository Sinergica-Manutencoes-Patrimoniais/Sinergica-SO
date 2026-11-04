import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { InicioProcessamento } from "./InicioProcessamento";

const resultado = z.object({ outboxId: z.string().uuid(), estadoFila: z.enum(["pending", "processing", "error", "sent"]), tentativas: z.number().int().nonnegative(), falhaRegistrada: z.boolean(), detalheInternoExistente: z.boolean(), classificacao: z.enum(["falha_sem_detalhes", "processando_resultado_incerto", "pendente", "enviado_nao_confirmado"]), estadoRemoto: z.literal("desconhecido"), autorizaRetry: z.literal(false) }).strict();
export function DiagnosticoFalhaFila({ userId, clienteId, outboxId }: { userId: string; clienteId: string; outboxId: string }) {
  const consulta = useQuery({ queryKey: ["reconciliacao-falha-fila", userId, clienteId, outboxId], gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_diagnostico_falha_fila", { p_cliente_id: clienteId, p_outbox_id: outboxId }).abortSignal(signal); if (error) throw error; const r = resultado.parse(data); if (r.outboxId !== outboxId) throw new Error("Item divergente"); return r; } });
  return <section aria-label="Diagnóstico sanitizado da fila"><h4>Diagnóstico atual</h4>
    {import.meta.env.VITE_SSO_INICIO_PROCESSAMENTO_ENABLED === "true" && <InicioProcessamento userId={userId} clienteId={clienteId} outboxId={outboxId} />}
    <p>Este é o estado atual, não um histórico de falhas. Situação remota desconhecida; sem retentativa externa.</p>
    {consulta.isFetching && <output>Consultando estado...</output>}{consulta.isError && <p role="alert">Diagnóstico indisponível ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <p>Fila: {consulta.data.estadoFila} · {consulta.data.tentativas} tentativa(s) · {consulta.data.classificacao} · {consulta.data.detalheInternoExistente ? "há detalhe interno não exibido" : "sem detalhe interno registrado"}.</p>}
  </section>;
}
