import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const previa = z.object({ outboxId: z.string().guid(), epoca: z.string().guid(), revisao: z.string().regex(/^\d+$/), situacaoRemota: z.literal("desconhecida"), autorizaRetry: z.literal(false) }).strict();
const comparacao = z.object({ outboxId: z.string().guid(), equivalente: z.boolean(), situacaoRemota: z.literal("desconhecida"), autorizaRetry: z.literal(false) }).strict();
type Previa = z.infer<typeof previa>;
export function RevisaoLateralFila({ userId, clienteId, outboxId }: { userId: string; clienteId: string; outboxId: string }) {
  const [captura, setCaptura] = useState<Previa | null>(null);
  const consulta = useQuery({ queryKey: ["reconciliacao-revisao-lateral", userId, clienteId, outboxId], gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_previa_revisao_fila", { p_cliente_id: clienteId, p_outbox_id: outboxId }).abortSignal(signal); if (error) throw error; const r = previa.parse(data); if (r.outboxId !== outboxId) throw new Error("Item divergente"); return r; } });
  const validar = useMutation({ mutationFn: async (p: Previa) => { const { data, error } = await supabase.schema("pcm").rpc("sso_revalidar_revisao_fila", { p_cliente_id: clienteId, p_outbox_id: outboxId, p_epoca: p.epoca, p_revisao: p.revisao }); if (error) throw error; const r = comparacao.parse(data); if (r.outboxId !== outboxId) throw new Error("Item divergente"); return r; } });
  return <section aria-label="Revisão lateral da fila"><h4>Revisão lateral</h4>
    <p>Revisão local observada somente durante a captura habilitada. Não comprova estado remoto e não autoriza retentativa.</p>
    {consulta.isFetching && <output>Consultando revisão…</output>}{consulta.isError && <p role="alert">Revisão indisponível ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <p>Revisão atual: {consulta.data.revisao}. <button type="button" onClick={() => { setCaptura(consulta.data); validar.reset(); }}>Guardar esta prévia</button></p>}
    {captura && <><p>Prévia guardada nesta tela: revisão {captura.revisao}.</p><button type="button" disabled={validar.isPending} onClick={() => validar.mutate(captura)}>Comparar prévia local</button></>}
    {validar.isError && <p role="alert">Não foi possível revalidar a prévia ou o acesso.</p>}{validar.data && <p>{validar.data.equivalente ? "Revisão e época equivalentes nesta consulta; não garante estado futuro." : "A revisão ou a época mudou; a prévia está desatualizada."}</p>}
  </section>;
}
