import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { formatarPropostaPublica } from "@sinergica/shared";
import { supabase } from "../../../lib/supabase-client";
import { criarRelatorioPdf } from "../../../lib/pdf/relatorio-pdf";
import { HistoricoPropostaOs } from "./HistoricoPropostaOs";
import { RecuperarDecisoesProposta } from "./RecuperarDecisoesProposta";
import { obterItensHistoricos, formatarItensHistoricos } from "../infrastructure/itens-publicos-proposta";
import { decidirPropostaOs, listarPropostasOs, validarDecisaoPropostaOs,
  obterDetalheOperacional, conferirSessaoProposta, type PropostaOs, type DecidirPropostaOs } from "../infrastructure/supabase-portal-propostas-os-adapter";

export function PropostasOsPortal({ userId, clienteId, osId, clienteNome }: { userId: string; clienteId: string; osId: string; clienteNome: string }) {
  if (import.meta.env.VITE_SSO_PORTAL_PROPOSTA_OS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([userId, clienteId, osId])} userId={userId} clienteId={clienteId} osId={osId} clienteNome={clienteNome} />;
}
function Conteudo({ userId, clienteId, osId, clienteNome }: { userId: string; clienteId: string; osId: string; clienteNome: string }) {
  const consulta = useInfiniteQuery({ queryKey: ["portal-propostas-os", userId, clienteId, osId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listarPropostasOs(clienteId, osId, pageParam, signal, userId),
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined,
    gcTime: 0, staleTime: 0, refetchOnWindowFocus: true, retry: false });
  const propostas = consulta.data?.pages.flat() ?? [];
  const paginasDivergentes = new Set(propostas.map((item) => item.id.toLowerCase())).size !== propostas.length;
  return <section aria-label="Orçamentos da ordem de serviço"><h3>Orçamentos da OS</h3>
    {import.meta.env.VITE_SSO_RECIBO_DECISAO_PROPOSTA_ENABLED === "true" && <RecuperarDecisoesProposta userId={userId} clienteId={clienteId} osId={osId} />}
    {consulta.isFetching && <p>Consultando orçamentos…</p>}
    {consulta.isError && <p role="alert">Orçamentos indisponíveis ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && paginasDivergentes && <p role="alert">As propostas mudaram durante a consulta. <button type="button" onClick={() => void consulta.refetch()}>Atualizar propostas</button></p>}
    {!consulta.isFetching && !consulta.isError && !paginasDivergentes && consulta.data && propostas.length === 0 && <p>Nenhum orçamento publicado.</p>}
    {!consulta.isFetching && !consulta.isError && !paginasDivergentes && propostas.map((item) =>
      <Item key={item.id} item={item} userId={userId} clienteId={clienteId} osId={osId} clienteNome={clienteNome} />)}
    {!consulta.isError && consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => { if (!consulta.isFetching) void consulta.fetchNextPage(); }}>Mais orçamentos</button>}
  </section>;
}
function Item({ item, userId, clienteId, osId, clienteNome }: { item: PropostaOs; userId: string; clienteId: string; osId: string; clienteNome: string }) {
  const chave = `sso-portal-proposta:${userId}:${clienteId}:${osId}:${item.id}`;
  const cliente = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [decisaoConcluida, setDecisaoConcluida] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const montado = useRef(false);
  const travaDecisao = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const exigeItens = import.meta.env.VITE_SSO_PROPOSTA_ITENS_PUBLICOS_ENABLED === "true";
  const itensPublicos = useQuery({ queryKey: ["portal-itens-proposta", userId, clienteId, osId, item.id, item.versao], enabled: exigeItens,
    gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: true, queryFn: async ({ signal }) => {
      await conferirSessaoProposta(userId, signal);
      const parametros={p_cliente_id:clienteId,p_os_id:osId,p_proposta_id:item.id,p_versao:item.versao};
      const requisicao=import.meta.env.VITE_SSO_ITENS_ATUAIS_PORTAL_MEDIADOS_ENABLED==="true"
        ? supabase.schema("comercial").rpc("sso_portal_itens_atuais_mediados",{...parametros,p_ator_id:userId})
        : supabase.schema("comercial").rpc("sso_portal_itens_publicos",parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error;
      const itens = z.array(z.object({ id: z.string().guid(), descricao: z.string().min(1), quantidade: z.number().int().positive(),
        precoUnitarioCentavos: z.number().int().nonnegative().safe() }).strict()).min(1).max(100).parse(data);
      await conferirSessaoProposta(userId, signal);
      return itens;
    } });
  const itensDisponiveis = !exigeItens || (!itensPublicos.isFetching && !itensPublicos.isError && !!itensPublicos.data?.length);
  const valor = item.payload.proposta.preco_centavos;
  const valorDisponivel = typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0;
  const fotografia = JSON.stringify([userId, clienteId, osId, item, exigeItens ? itensPublicos.data ?? null : null, motivo.trim()]);
  const conferido = (decisao: "aceita" | "recusada") => confirmacao === JSON.stringify([fotografia, decisao]);
  const [pendente, setPendente] = useState<DecidirPropostaOs | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = validarDecisaoPropostaOs(JSON.parse(salvo)); return p.propostaId === item.id ? p : "invalido";
    } catch { return "invalido"; }
  });
  const enviar = useMutation({ mutationFn: async (pedido: DecidirPropostaOs) => {
    await conferirSessaoProposta(userId);
    if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Tentativa alterada.");
    const resultado = await decidirPropostaOs(pedido, userId, {clienteId,osId});
    await conferirSessaoProposta(userId);
    return resultado;
  },
    onSuccess: async (_resultado, confirmado) => { try {
      await cliente.invalidateQueries({ queryKey: ["portal-propostas-os", userId, clienteId, osId], refetchType: "none" });
      await conferirSessaoProposta(userId);
      if (sessionStorage.getItem(chave) !== JSON.stringify(confirmado)) throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave);
    } catch { setMensagem("Decisão salva; contate suporte para limpar tentativa local."); return; }
      setDecisaoConcluida(true); setPendente(null); setConfirmacao(null); setMensagem("Decisão registrada.");
      void cliente.refetchQueries({ queryKey: ["portal-propostas-os", userId, clienteId, osId], type: "active" }); },
    onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa e procure suporte se necessário."),
    onSettled: () => { travaDecisao.current = false; },
  });
  function registrar(p: DecidirPropostaOs) {
    if (travaDecisao.current) return;
    try {
      const existente = sessionStorage.getItem(chave);
      if (existente !== null && existente !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      if (existente === null && pendente) throw new Error("Tentativa ausente.");
      if (existente === null) sessionStorage.setItem(chave, JSON.stringify(p));
    } catch { setMensagem("Não foi possível preservar a tentativa; decisão não enviada. Contate suporte."); return; }
    setPendente(p); setMensagem(""); travaDecisao.current = true; enviar.mutate(p);
  }
  function decidir(decisao: "aceita" | "recusada") {
    if (decisaoConcluida || pendente || enviar.isPending || travaDecisao.current || !itensDisponiveis || !conferido(decisao) || (decisao === "aceita" && !valorDisponivel)) return;
    try { registrar(validarDecisaoPropostaOs({ requestId: crypto.randomUUID(), propostaId: item.id,
      versao: item.versao, decisao, motivo: decisao === "recusada" ? motivo.trim() : null })); }
    catch { setMensagem("Informe o motivo da recusa."); }
  }
  async function baixarPdf() {
    if (baixando) return;
    setBaixando(true); setMensagem("");
    try {
      await conferirSessaoProposta(userId);
      const payload = await obterDetalheOperacional(clienteId, osId, item.id, item.versao, userId);
      const estruturado = exigeItens ? await obterItensHistoricos(clienteId, osId, item.id, item.versao, userId) : null;
      if (exigeItens && !estruturado?.estruturado) throw new Error("Itens públicos ausentes.");
      const pdf = await criarRelatorioPdf({ titulo: "Proposta Comercial", subtitulo: `${clienteNome} · v${item.versao}` });
      pdf.escreverTexto(formatarPropostaPublica(payload, clienteNome, { omitirItens: estruturado?.estruturado === true }));
      if (estruturado) pdf.escreverTexto(formatarItensHistoricos(estruturado));
      const bytes = await pdf.finalizar();
      const atual = await obterDetalheOperacional(clienteId, osId, item.id, item.versao, userId);
      if (JSON.stringify(atual) !== JSON.stringify(payload)) throw new Error("Proposta alterada.");
      if (estruturado && JSON.stringify(await obterItensHistoricos(clienteId, osId, item.id, item.versao, userId)) !== JSON.stringify(estruturado)) throw new Error("Itens alterados.");
      await conferirSessaoProposta(userId);
      if (!montado.current) return;
      const endereco = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }));
      const link = document.createElement("a"); link.href = endereco; link.download = `proposta-operacional-v${item.versao}.pdf`; link.click();
      setTimeout(() => URL.revokeObjectURL(endereco), 1000);
    } catch { setMensagem("Não foi possível exportar a versão atual ou o acesso foi revogado."); }
    finally { setBaixando(false); }
  }
  return <div className="mt-3 rounded-lg border border-line p-3">
    <p>Versão {item.versao} · {item.status} {item.valido_ate ? `· Válido até ${item.valido_ate}` : ""}</p>
    {item.payload.proposta.escopo && <p>{item.payload.proposta.escopo}</p>}
    {valorDisponivel ? <p>Preço: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor / 100)}</p> : <p role="alert">Preço indisponível ou inválido; aprovação bloqueada.</p>}
    <ul>{item.payload.itens.map((linha, i) => <li key={`${item.id}-${i}`}>{linha.descricao ?? `Item ${i + 1}`}</li>)}</ul>
    {exigeItens && itensPublicos.isFetching && <p>Consultando itens da versão…</p>}
    {exigeItens && itensPublicos.isError && <p role="alert">Itens da versão indisponíveis; decisão bloqueada. <button type="button" onClick={() => void itensPublicos.refetch()}>Tentar novamente</button></p>}
    {exigeItens && itensDisponiveis && <ul>{itensPublicos.data?.map((linha) => <li key={linha.id}>{linha.descricao} · {linha.quantidade} × {linha.precoUnitarioCentavos} centavos</li>)}</ul>}
    {import.meta.env.VITE_SSO_EXPORTAR_PROPOSTA_OPERACIONAL_ENABLED === "true" && <button type="button" disabled={baixando} onClick={() => void baixarPdf()}>{baixando ? "Gerando PDF…" : "Baixar versão pública em PDF"}</button>}
    <HistoricoPropostaOs userId={userId} clienteId={clienteId} osId={osId} propostaId={item.id} clienteNome={clienteNome} />
    {item.status === "enviada" && !decisaoConcluida && <div>
      <label><input type="checkbox" checked={conferido("aceita")} disabled={!!pendente || enviar.isPending || !itensDisponiveis} onChange={(e) => setConfirmacao(e.target.checked ? JSON.stringify([fotografia, "aceita"]) : null)} /> Conferi esta versão para aprovação.</label>
      <button type="button" disabled={!valorDisponivel || !conferido("aceita") || !!pendente || enviar.isPending || !itensDisponiveis} onClick={() => decidir("aceita")}>Aprovar esta versão</button>
      <label>Motivo da recusa <input maxLength={2000} disabled={!!pendente || enviar.isPending} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <label><input type="checkbox" checked={conferido("recusada")} disabled={!!pendente || enviar.isPending || !itensDisponiveis || !motivo.trim()} onChange={(e) => setConfirmacao(e.target.checked ? JSON.stringify([fotografia, "recusada"]) : null)} /> Conferi esta versão e o motivo para recusa.</label>
      <button type="button" disabled={!conferido("recusada") || !!pendente || enviar.isPending || !itensDisponiveis || !motivo.trim()} onClick={() => decidir("recusada")}>Recusar esta versão</button></div>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending || !itensDisponiveis} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </div>;
}
