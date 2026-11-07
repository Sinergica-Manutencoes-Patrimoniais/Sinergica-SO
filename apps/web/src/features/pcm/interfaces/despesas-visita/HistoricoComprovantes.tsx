import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useLayoutEffect, useRef } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

type Props = { userId: string; clienteId: string; visitaId: string; despesaId: string };
const linha = z.object({ revisao: z.number().int().positive(), valor_centavos: z.number().int().nonnegative().safe(),
  ator_id: z.string().guid(), registrado_em: z.string(), tipo: z.enum(["realizacao", "correcao"]) }).strict();
export function HistoricoComprovantes(props: Props) {
  if (import.meta.env.VITE_SSO_HISTORICO_COMPROVANTES_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.visitaId, props.despesaId])} {...props} />;
}
function Conteudo({ userId, clienteId, visitaId, despesaId }: Props) {
  const montado=useRef(false);
  useLayoutEffect(()=>{montado.current=true;return()=>{montado.current=false;};},[]);
  async function conferirSessao(signal?:AbortSignal){const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||signal?.aborted)throw new Error("Sessão alterada.");}
  const consulta = useInfiniteQuery({ queryKey: ["despesa-historico-comprovantes", userId, clienteId, visitaId, despesaId],
    initialPageParam: 0, gcTime: 0, staleTime: 0, refetchOnWindowFocus: true, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const requisicao=import.meta.env.VITE_SSO_HISTORICO_COMPROVANTES_MEDIADO_ENABLED==="true"
        ? supabase.schema("pcm").rpc("sso_historico_realizacao_despesa_mediado",{p_ator_id:userId,p_cliente_id:clienteId,p_visita_id:visitaId,p_despesa_id:despesaId,p_apos:pageParam})
        : supabase.schema("pcm").rpc("sso_historico_realizacao_despesa",{p_despesa_id:despesaId,p_apos:pageParam});
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error; const pagina=z.array(linha).max(20).parse(data);let anterior=pageParam;
      for(const item of pagina){if(item.revisao<=anterior)throw new Error("Página divergente.");anterior=item.revisao;}
      await conferirSessao(signal);return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.revisao : undefined });
  const baixar = useMutation({ mutationFn: async (revisao: number) => {
    await conferirSessao();
    const unificado = import.meta.env.VITE_SSO_HISTORICO_COMPROVANTES_UNIFICADO_ENABLED === "true";
    const { data, error } = unificado
      ? await supabase.functions.invoke<Blob>("despesa-visita-comprovante-historico-unificado", { body: {}, headers: { "x-despesa-id": despesaId, "x-revisao": String(revisao) } })
      : await supabase.functions.invoke<Blob>("despesa-visita-comprovante-historico", { body: { despesaId, revisao } });
    if (error) throw error;
    if (!(data instanceof Blob)) throw new Error("Resposta inválida.");
    await conferirSessao();
    if(!montado.current) return;
    const endereco = URL.createObjectURL(data); const link = document.createElement("a");
    link.href = endereco; link.download = `comprovante-revisao-${revisao}`; link.click();
    setTimeout(() => URL.revokeObjectURL(endereco), 1000);
  } });
  return <section aria-label="Histórico de comprovantes"><h5>Histórico de comprovantes</h5>
    {consulta.isFetching && <p>Consultando histórico…</p>}
    {consulta.isError && <p role="alert">Histórico indisponível ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().length === 0 && <p>Nenhuma realização registrada.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().map((item) => <p key={item.revisao}>
      Revisão {item.revisao} · {item.tipo} · {item.valor_centavos} centavos · {new Date(item.registrado_em).toLocaleString("pt-BR")} · autor {item.ator_id}{" "}
      <button type="button" disabled={baixar.isPending} onClick={() => baixar.mutate(item.revisao)}>Baixar comprovante</button>
    </p>)}
    {!consulta.isError && consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais versões</button>}
    {baixar.isError && <p role="alert">Comprovante indisponível ou sem acesso.</p>}
  </section>;
}
