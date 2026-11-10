import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

type Props = { userId: string; clienteId: string; osId: string };
const item = z.object({ nota_id: z.string().guid(), enviado_em: z.string() }).strict();
export function AnexosPropriosOs(props: Props) {
  if (import.meta.env.VITE_SSO_PORTAL_ANEXOS_PROPRIOS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.osId])} {...props} />;
}
function Conteudo({ userId, clienteId, osId }: Props) {
  async function conferirSessao(signal?: AbortSignal) { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada."); }
  const consulta = useInfiniteQuery({ queryKey: ["portal-anexos-proprios", userId, clienteId, osId], gcTime: 0,
    retry: false, staleTime: 0, refetchOnWindowFocus: true, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal); const { data, error } = await supabase.schema("pcm").rpc("sso_portal_anexos_proprios_mediado", {
        p_ator_id: userId, p_cliente_id: clienteId, p_os_id: osId, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(item).max(20).parse(data); let anterior = pageParam?.toLowerCase() ?? ""; for (const a of pagina) { if (a.nota_id.toLowerCase() <= anterior) throw new Error("Página divergente."); anterior = a.nota_id.toLowerCase(); } await conferirSessao(signal); return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.nota_id : undefined });
  const baixar = useMutation({ mutationFn: async (id: string) => {
    await conferirSessao(); const { data, error } = await supabase.functions.invoke<Blob>("portal-anexo-proprio-seguro", { body: { lancamentoId: id } });
    if (error) throw error; if (!(data instanceof Blob)) throw new Error("Resposta inválida.");
    await conferirSessao();
    const endereco = URL.createObjectURL(data); const link = document.createElement("a");
    link.href = endereco; link.download = "anexo-enviado"; link.click(); setTimeout(() => URL.revokeObjectURL(endereco), 1000);
  } });
  const anexos = consulta.data?.pages.flat() ?? []; const consistentes = anexos.every((a,i) => i === 0 || anexos[i-1]!.nota_id.toLowerCase() < a.nota_id.toLowerCase());
  return <section aria-label="Meus anexos enviados"><h3>Meus anexos enviados</h3>
    {consulta.isFetching && <p>Consultando anexos…</p>}
    {consulta.isError && <p role="alert">Anexos indisponíveis ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consistentes && <p role="alert">Páginas divergentes. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().length === 0 && <p>Nenhum anexo enviado por você.</p>}
    {!consulta.isFetching && !consulta.isError && consistentes && anexos.map((a) => <p key={a.nota_id}>
      Enviado em {new Date(a.enviado_em).toLocaleString("pt-BR")} <button type="button" disabled={baixar.isPending} onClick={() => baixar.mutate(a.nota_id)}>Baixar anexo</button></p>)}
    {!consulta.isError && consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais anexos</button>}
    {baixar.isError && <p role="alert">Arquivo indisponível ou sem acesso.</p>}
  </section>;
}
