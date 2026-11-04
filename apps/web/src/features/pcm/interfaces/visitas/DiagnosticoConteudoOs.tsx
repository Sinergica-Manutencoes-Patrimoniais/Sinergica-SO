import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const schema = z.object({ visitaId: z.string().uuid(), osId: z.string().uuid(), revision: z.number().int().positive(),
  alvo: z.enum(["desconhecido", "referencia_sistema_nao_comprovada"]), questionario: z.enum(["aplicabilidade_desconhecida", "referencia_nao_comprovada"]),
  escopo: z.enum(["indisponivel", "sem_atribuicao_conhecida", "atribuicoes_parciais"]), atribuicoes: z.number().int().nonnegative().nullable(),
  revisaoCompleta: z.literal(false), autorizaEnvio: z.literal(false) }).strict();
export function DiagnosticoConteudoOs({ userId, clienteId, visitaId, osId, revisao }: { userId: string; clienteId: string; visitaId: string; osId: string; revisao: number }) {
  const consulta = useQuery({ queryKey: ["diagnostico-conteudo-os", userId, clienteId, visitaId, osId, revisao], gcTime: 0, staleTime: 0, retry: false,
    refetchOnWindowFocus: true, queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_diagnostico_conteudo_os", {
      p_cliente_id: clienteId, p_visita_id: visitaId, p_os_id: osId }).abortSignal(signal);
      if (error) throw error; const r = schema.parse(data); if (r.visitaId !== visitaId || r.osId !== osId) throw new Error("Resposta divergente"); return r; } });
  return <section aria-label="Completude do conteúdo da OS">
    {consulta.isFetching && <p>Consultando completude…</p>}{consulta.isError && <p role="alert">Completude indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <div>
      <p>Alvo: {consulta.data.alvo === "desconhecido" ? "desconhecido" : "há referência de Sistema, alvo funcional não comprovado"}.</p>
      <p>Questionário: {consulta.data.questionario === "aplicabilidade_desconhecida" ? "aplicabilidade desconhecida" : "há referência, conteúdo e versão não comprovados"}.</p>
      <p>Escopo: {consulta.data.escopo === "indisponivel" ? "fonte indisponível ou sem acesso" : consulta.data.escopo === "sem_atribuicao_conhecida" ? "nenhuma atribuição conhecida; completude desconhecida" : `${consulta.data.atribuicoes} atribuição(ões) identificada(s); completude desconhecida`}.</p>
      <p>Revisão integral não comprovada; envio permanece bloqueado.{consulta.data.revision !== revisao && " A Visita mudou; atualize a tela."}</p>
    </div>}
  </section>;
}
