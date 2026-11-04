import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const respostaSchema = z.object({
  tipo: z.enum(["sistema", "componente"]), ativoId: z.string().uuid(), clienteId: z.string().uuid(),
  vinculoAuvoAtual: z.boolean(), referenciaOsObservada: z.boolean(), aliasObservado: z.boolean(), cicloRegistrado: z.boolean(),
  aprovadoEm: z.string().nullable(), sincronizadoEm: z.string().nullable(), etiquetadoEm: z.string().nullable(), referenciadoOsEm: z.string().nullable(),
}).strict();
type Props = { userId: string; clienteId: string; tipo: "sistema" | "componente"; ativoId: string };

export function EvidenciasUso(props: Props) {
  if (import.meta.env.VITE_SSO_EVIDENCIAS_USO_CODIGO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.tipo, props.ativoId])} {...props} />;
}

function Conteudo({ userId, clienteId, tipo, ativoId }: Props) {
  const consulta = useQuery({
    queryKey: ["codigos-publicos", userId, clienteId, tipo, ativoId, "evidencias-uso"], gcTime: 0,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_evidencias_uso_codigo", {
        p_ator_id: userId, p_cliente_id: clienteId, p_tipo: tipo, p_ativo_id: ativoId,
      }).abortSignal(signal);
      if (error) throw error;
      const resposta = respostaSchema.parse(data);
      if (resposta.clienteId !== clienteId || resposta.tipo !== tipo || resposta.ativoId !== ativoId) throw new Error("Resposta divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return resposta;
    },
  });
  if (consulta.isFetching || consulta.isPending) return <output>Consultando evidências de uso…</output>;
  if (consulta.isError || !consulta.data) return <p role="alert">Evidências indisponíveis. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>;
  const d = consulta.data;
  const marcos = [["Aprovação", d.aprovadoEm], ["Sincronização", d.sincronizadoEm], ["Etiquetagem declarada", d.etiquetadoEm], ["Referência em OS", d.referenciadoOsEm]] as const;
  return <section aria-label="Evidências de uso do código">
    <h3>Evidências de uso observadas</h3>
    <p>Ausência de evidência não comprova ausência de uso anterior e não autoriza alteração de código.</p>
    <ul>
      <li>Vínculo Auvo atual: {d.vinculoAuvoAtual ? "observado" : "não observado"}</li>
      <li>Referência em OS: {d.referenciaOsObservada ? "observada" : "não observada"}</li>
      <li>Código anterior registrado: {d.aliasObservado ? "observado" : "não observado"}</li>
      <li>Ciclo de código: {d.cicloRegistrado ? "registrado" : "não registrado"}</li>
      {marcos.filter(([, data]) => data !== null).map(([nome, data]) => <li key={nome}>{nome}: {data}</li>)}
    </ul>
  </section>;
}
