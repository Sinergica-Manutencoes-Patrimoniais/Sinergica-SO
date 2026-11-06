import { formatarPropostaPublica } from "@sinergica/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { criarRelatorioPdf } from "../../../lib/pdf/relatorio-pdf";
import { supabase } from "../../../lib/supabase-client";
import { conferirSessaoProposta, obterVersaoOperacional } from "../infrastructure/supabase-portal-propostas-os-adapter";
import { obterItensHistoricos, formatarItensHistoricos } from "../infrastructure/itens-publicos-proposta";

type Props = { userId: string; clienteId: string; osId: string; propostaId: string; clienteNome: string };
export function HistoricoPropostaOs(props: Props) {
  if (import.meta.env.VITE_SSO_HISTORICO_PROPOSTA_OS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.osId, props.propostaId])} {...props} />;
}
function Conteudo({ userId, clienteId, osId, propostaId, clienteNome }: Props) {
  const [versao, setVersao] = useState<number | null>(null);
  const [baixando, setBaixando] = useState(false); const [mensagem, setMensagem] = useState("");
  const geracao = useRef(0);
  useEffect(() => () => { geracao.current++; }, []);
  const historico = useInfiniteQuery({ queryKey: ["portal-historico-proposta", userId, clienteId, osId, propostaId],
    gcTime: 0, retry: false, staleTime: 0, refetchOnWindowFocus: true, initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoProposta(userId, signal);
      const parametros={p_cliente_id:clienteId,p_os_id:osId,p_proposta_id:propostaId,p_apos:pageParam};
      const requisicao=import.meta.env.VITE_SSO_HISTORICO_PROPOSTA_MEDIADO_ENABLED==="true"?supabase.schema("comercial").rpc("sso_portal_historico_operacional_mediado",{...parametros,p_ator_id:userId}):supabase.schema("comercial").rpc("sso_portal_historico_operacional",parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(z.object({ versao: z.number().int().positive().safe(), publicado_em: z.string().datetime({ offset: true }) }).strict()).max(20).parse(data);
      let anterior = pageParam;
      for (const item of pagina) { if (item.versao <= anterior) throw new Error("Página inválida."); anterior = item.versao; }
      await conferirSessaoProposta(userId, signal);
      return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.versao : undefined });
  const versoes = historico.data?.pages.flat() ?? []; const consistentes = versoes.every((item, i) => i === 0 || versoes[i - 1]!.versao < item.versao);
  const versaoVisivel = versao !== null && consistentes && !historico.isFetching && !historico.isError && versoes.some((item) => item.versao === versao);
  const detalhe = useQuery({ queryKey: ["portal-versao-proposta", userId, clienteId, osId, propostaId, versao],
    enabled: versaoVisivel, gcTime: 0, retry: false, staleTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => { if (versao === null) throw new Error("Versão ausente."); await conferirSessaoProposta(userId, signal); const resultado = await obterVersaoOperacional(clienteId, osId, propostaId, versao, userId); await conferirSessaoProposta(userId, signal); return resultado; } });
  const exigeItens = import.meta.env.VITE_SSO_PROPOSTA_ITENS_PUBLICOS_ENABLED === "true";
  const itens = useQuery({ queryKey: ["portal-itens-historicos", userId, clienteId, osId, propostaId, versao],
    enabled: exigeItens && versaoVisivel, gcTime: 0, retry: false, staleTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => { if (versao === null) throw new Error("Versão ausente."); await conferirSessaoProposta(userId, signal); const resultado = await obterItensHistoricos(clienteId, osId, propostaId, versao, userId); await conferirSessaoProposta(userId, signal); return resultado; } });
  async function baixar() {
    if (versao === null || !versaoVisivel || baixando) return;
    const operacao = ++geracao.current;
    setBaixando(true); setMensagem("");
    try {
      await conferirSessaoProposta(userId);
      const payload = await obterVersaoOperacional(clienteId, osId, propostaId, versao, userId);
      const estruturado = exigeItens ? await obterItensHistoricos(clienteId, osId, propostaId, versao, userId) : null;
      const pdf = await criarRelatorioPdf({ titulo: "Proposta Comercial", subtitulo: `${clienteNome} · v${versao}` });
      pdf.escreverTexto(formatarPropostaPublica(payload, clienteNome, { omitirItens: estruturado?.estruturado === true }));
      if (estruturado) pdf.escreverTexto(formatarItensHistoricos(estruturado));
      const bytes = await pdf.finalizar();
      const atual = await obterVersaoOperacional(clienteId, osId, propostaId, versao, userId);
      if (JSON.stringify(atual) !== JSON.stringify(payload)) throw new Error("Versão alterada.");
      if (estruturado && JSON.stringify(await obterItensHistoricos(clienteId, osId, propostaId, versao, userId)) !== JSON.stringify(estruturado)) throw new Error("Itens alterados.");
      await conferirSessaoProposta(userId);
      if (operacao !== geracao.current) return;
      const endereco = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }));
      const link = document.createElement("a"); link.href = endereco; link.download = `proposta-operacional-v${versao}.pdf`; link.click();
      setTimeout(() => URL.revokeObjectURL(endereco), 1000);
    } catch { if (operacao === geracao.current) setMensagem("Não foi possível exportar esta versão ou o acesso foi revogado."); }
    finally { if (operacao === geracao.current) setBaixando(false); }
  }
  return <section aria-label="Histórico de versões públicas"><h5>Versões públicas</h5>
    <p>Apenas versões publicadas explicitamente são exibidas.</p>
    {historico.isFetching && <p>Consultando versões…</p>}
    {historico.isError && <p role="alert">Histórico indisponível ou sem acesso. <button type="button" onClick={() => void historico.refetch()}>Tentar novamente</button></p>}
    {!consistentes && <p role="alert">Páginas de versões divergentes. <button type="button" onClick={() => void historico.refetch()}>Reconsultar</button></p>}
    {!historico.isFetching && !historico.isError && historico.data?.pages.flat().length === 0 && <p>Nenhuma versão publicada.</p>}
    {!historico.isFetching && !historico.isError && consistentes && versoes.map((h) => <p key={h.versao}>
      Versão {h.versao} · {new Date(h.publicado_em).toLocaleString("pt-BR")} <button type="button" onClick={() => { geracao.current++; setBaixando(false); setVersao(h.versao); }}>Consultar versão</button></p>)}
    {!historico.isError && historico.hasNextPage && <button type="button" disabled={historico.isFetching} onClick={() => {if(!historico.isFetching)void historico.fetchNextPage();}}>Mais versões</button>}
    {versao !== null && detalhe.isFetching && <p>Consultando versão…</p>}
    {versao !== null && detalhe.isError && <p role="alert">Versão indisponível ou sem acesso.</p>}
    {versaoVisivel && !detalhe.isFetching && !detalhe.isError && detalhe.data && <div>
      <p>Versão {versao}: {detalhe.data.proposta.escopo ?? "Escopo não informado"}</p>
      {detalhe.data.proposta.preco_centavos !== undefined && <p>Preço: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(detalhe.data.proposta.preco_centavos / 100)}</p>}
      {!(exigeItens && itens.data?.estruturado) && <ul>{detalhe.data.itens.map((i, n) => <li key={`${versao}-${n}`}>{i.descricao ?? `Item ${n + 1}`}</li>)}</ul>}
      {exigeItens && itens.isFetching && <p>Consultando itens da versão…</p>}
      {exigeItens && itens.isError && <p role="alert">Itens históricos indisponíveis; exportação bloqueada. <button type="button" onClick={() => void itens.refetch()}>Tentar novamente</button></p>}
      {exigeItens && !itens.isFetching && !itens.isError && itens.data && (itens.data.estruturado ?
        <ul>{itens.data.itens.map((i) => <li key={i.id}>{i.descricao} · {i.quantidade} × {i.precoUnitarioCentavos} centavos</li>)}</ul> :
        <p>Esta versão anterior não possui snapshot estruturado de itens.</p>)}
      <button type="button" disabled={baixando || (exigeItens && (itens.isFetching || itens.isError || !itens.data))} onClick={() => void baixar()}>{baixando ? "Gerando PDF…" : "Baixar versão pública"}</button>
    </div>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
