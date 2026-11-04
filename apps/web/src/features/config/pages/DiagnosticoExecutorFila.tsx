import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const diagnostico = z.object({ habilitado: z.boolean(), intervaloMinutos: z.number().int().min(5).max(10080),
  ultimaConclusao: z.string().datetime({ offset: true }).nullable(), efeitoRemotoComprovado: z.literal(false),
  execucaoAtual: z.object({ id: z.string().uuid(), estado: z.string().min(1).max(100), revisao: z.number().int().nonnegative(),
    considerados: z.number().int().nonnegative().safe(), alterados: z.number().int().nonnegative().safe(),
    criadaEm: z.string().datetime({ offset: true }), atualizadaEm: z.string().datetime({ offset: true }) }).strict().nullable() }).strict();

export function DiagnosticoExecutorFila({ userId }: { userId: string }) {
  const consulta = useQuery({ queryKey: ["config-diagnostico-executor-fila", userId], gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_diagnosticar_executor_fila_admin", { p_ator_id: userId }).abortSignal(signal);
      if (error) throw error;
      const r = diagnostico.parse(data);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return r;
    },
  });
  const d = !consulta.isFetching && !consulta.isError ? consulta.data : undefined;
  return <section aria-label="Diagnóstico do executor de integrações"><h3>Executor de reconciliação</h3>
    <p>Diagnóstico interno. A atualização registrada não comprova que o executor está ativo, que uma tarefa falhou ou que houve efeito no Auvo.</p>
    {consulta.isFetching && <output>Consultando executor…</output>}
    {consulta.isError && <p role="alert">Diagnóstico indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {d && <><p>Configuração: {d.habilitado ? "habilitada" : "desabilitada"} · intervalo {d.intervaloMinutos} min · última conclusão {d.ultimaConclusao ? new Date(d.ultimaConclusao).toLocaleString("pt-BR") : "não registrada"}.</p>
      {d.execucaoAtual ? <p>Execução {d.execucaoAtual.id} · {d.execucaoAtual.estado} · revisão {d.execucaoAtual.revisao} · {d.execucaoAtual.considerados} considerados · {d.execucaoAtual.alterados} alterados · atualização {new Date(d.execucaoAtual.atualizadaEm).toLocaleString("pt-BR")}.</p> : <p>Nenhuma execução atual registrada.</p>}
      <button type="button" onClick={() => void consulta.refetch()}>Atualizar diagnóstico</button></>}
  </section>;
}
