import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { SubstituicaoCodigoPublico } from "../codigos-publicos/Substituicao";

const item = z.object({ id: z.string().guid(), codigo: z.string().min(1).max(200), atual: z.boolean(), ator_id: z.string().guid(), criado_em: z.string() }).strict();
type Props = { userId: string; clienteId: string; grupoId: string };

export function CodigoAtualGrupo(props: Props) {
  if (import.meta.env.VITE_SSO_SUBSTITUICAO_CODIGO_GRUPO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.grupoId])} {...props} />;
}

function Conteudo({ userId, clienteId, grupoId }: Props) {
  const consulta=useQuery({
    queryKey:["codigos-publicos",userId,clienteId,"grupo-atual",grupoId],gcTime:0,retry:false,
    queryFn:async ({signal})=>{
      const antes=await supabase.auth.getUser();
      if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_historico_codigo_grupo",{p_cliente_id:clienteId,p_grupo_id:grupoId,p_apos:null,p_apos_id:null,p_limite:1}).abortSignal(signal);
      if(error)throw error;
      const pagina=z.array(item).max(1).parse(data);
      if(pagina.length && !pagina[0]!.atual)throw new Error("Código atual indisponível.");
      const depois=await supabase.auth.getUser();
      if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      return pagina[0]?.codigo ?? null;
    },
  });
  return <section aria-label="Código público do Grupo">
    {consulta.isFetching && <p>Consultando código…</p>}
    {consulta.isError && <p role="alert">Código indisponível. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data === null && <p>Grupo sem código público registrado.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <><p>Código público: {consulta.data}</p>
      <SubstituicaoCodigoPublico userId={userId} clienteId={clienteId} tipo="grupo_quantitativo" ativoId={grupoId} codigoAnterior={consulta.data} /></>}
  </section>;
}
