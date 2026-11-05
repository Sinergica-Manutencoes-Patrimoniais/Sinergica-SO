import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
import { ResolverRetiradaImpacto } from "./ResolverRetiradaImpacto";

type Props = { userId: string; clienteId: string; planoId: string; rascunhoId: string; preparadaId: string; planoRevision: number; decisaoRevision: number; tipo: "calendario" | "visita" };
export function EstadoEscolhaAlteracao(props: Props) {
  if (import.meta.env.VITE_SSO_ALTERACAO_CICLO_ENABLED !== "true") return <ResolverRetiradaImpacto {...props} />;
  return <Consulta key={JSON.stringify(props)} {...props} />;
}
function Consulta(props: Props) {
  const { userId, clienteId, planoId, rascunhoId, preparadaId, planoRevision, decisaoRevision, tipo } = props;
  const q = useQuery({ queryKey: ["escolha-alteracao-ciclo", userId, clienteId, planoId, rascunhoId, preparadaId, planoRevision, decisaoRevision, tipo], retry: false, gcTime: 0, queryFn: async ({ signal }) => {
    await conferirSessaoDiagnostico(userId, signal);
    const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_escolha_alteracao_ciclo", { p_ator: userId, p_cliente: clienteId, p_plano: planoId, p_rascunho: rascunhoId, p_preparada: preparadaId, p_revisao_plano: planoRevision, p_revisao_decisao: decisaoRevision, p_tipo: tipo }).abortSignal(signal);
    if (error) throw error;
    const r = z.object({ preparadaId: z.string().uuid(), revisaoDecisao: z.number().int().positive(), registrada: z.boolean(), atual: z.boolean() }).strict().parse(data);
    if (r.preparadaId !== preparadaId || r.revisaoDecisao !== decisaoRevision || (r.atual && !r.registrada)) throw new Error("Resposta divergente.");
    await conferirSessaoDiagnostico(userId, signal); return r;
  } });
  if (q.isFetching) return <p role="status">Consultando decisão da ocorrência...</p>;
  if (q.isError || !q.data) return <p role="alert">Não foi possível consultar a decisão. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>;
  if (q.data.registrada && q.data.atual) return <p>Alteração escolhida para esta ocorrência. A nova versão só será aplicada após aprovação e vigência; a OS existente não será alterada.</p>;
  if (q.data.registrada) return <p role="alert">A escolha de alteração está desatualizada. Confira a comparação e registre nova decisão.</p>;
  return <ResolverRetiradaImpacto {...props} />;
}
