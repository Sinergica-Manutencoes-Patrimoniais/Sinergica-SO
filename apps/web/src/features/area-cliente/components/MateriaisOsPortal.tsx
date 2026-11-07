import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { HistoricoMateriais } from "./HistoricoMateriais";
import { ListasHistoricoMateriais } from "./ListasHistoricoMateriais";
import { RecuperarDisponibilidadesMateriais } from "./RecuperarDisponibilidadesMateriais";
import { consultarReciboDisponibilidadePortal, informarDisponibilidadePortal, listarMateriaisPortal, validarPedidoDisponibilidade,
  type ListaPortal, type PedidoDisponibilidade } from "../infrastructure/supabase-portal-materiais-adapter";

export function MateriaisOsPortal({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  if (import.meta.env.VITE_SSO_PORTAL_MATERIAIS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([userId, clienteId, osId])} userId={userId} clienteId={clienteId} osId={osId} />;
}
function Conteudo({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  const chave = ["portal-materiais", userId, clienteId, osId] as const;
  const consulta = useInfiniteQuery({ queryKey: chave, initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listarMateriaisPortal(clienteId, osId, pageParam, signal, userId),
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina[pagina.length - 1]?.id : undefined,
    gcTime: 0, staleTime: 0, refetchOnWindowFocus: true, retry: false });
  const listas = consulta.data?.pages.flat() ?? [];
  const divergentes = listas.some((item, indice) => indice > 0 && item.id.toLowerCase() <= listas[indice - 1]!.id.toLowerCase());
  return <section aria-label="Materiais da ordem de serviço">
    <h3>Materiais</h3>
    {consulta.isFetching && <p>Consultando materiais…</p>}
    {consulta.isError && <p role="alert">Materiais indisponíveis ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && divergentes && <p role="alert">As páginas de materiais mudaram durante a consulta. <button type="button" onClick={() => void consulta.refetch()}>Consultar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && !divergentes && consulta.data && listas.length === 0 && <p>Nenhuma lista publicada.</p>}
    {!consulta.isFetching && !consulta.isError && !divergentes && listas.map((item) =>
      <Lista key={item.id} item={item} userId={userId} clienteId={clienteId} osId={osId} />)}
    {!consulta.isError && !divergentes && consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => { if (!consulta.isFetching) void consulta.fetchNextPage(); }}>Mais listas</button>}
    {import.meta.env.VITE_SSO_RECIBO_DISPONIBILIDADE_MATERIAIS_ENABLED === "true" &&
      <RecuperarDisponibilidadesMateriais userId={userId} clienteId={clienteId} osId={osId}
        listasVisiveis={!consulta.isFetching && !consulta.isError && !divergentes ? listas.map((item) => item.id) : []} />}
    <ListasHistoricoMateriais userId={userId} clienteId={clienteId} osId={osId} />
  </section>;
}
function Lista({ item, userId, clienteId, osId }: { item: ListaPortal; userId: string; clienteId: string; osId: string }) {
  const chave = `sso-portal-material:${userId}:${clienteId}:${osId}:${item.id}`;
  const cliente = useQueryClient();
  const [situacao, setSituacao] = useState<PedidoDisponibilidade["situacao"] | "">("");
  const [revisaoConferida, setRevisaoConferida] = useState(item.revisao);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const trava = useRef(false);
  const revisaoAlterada = revisaoConferida !== item.revisao;
  const fotografia = JSON.stringify([userId, clienteId, osId, item.id, item.revisao, item.responsavel, item.estado, item.linhas, situacao]);
  const [pendente, setPendente] = useState<PedidoDisponibilidade | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const pedido = validarPedidoDisponibilidade(JSON.parse(salvo)); return pedido.listaId === item.id ? pedido : "invalido";
    } catch { return "invalido"; }
  });
  const enviar = useMutation({ mutationFn: (pedido: PedidoDisponibilidade) => informarDisponibilidadePortal(pedido, userId, { clienteId, osId }),
    onSuccess: async (_resultado, confirmado) => { try {
      await cliente.invalidateQueries({ queryKey: ["portal-materiais", userId, clienteId, osId], refetchType: "none" });
      const atual = await supabase.auth.getUser();
      if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(confirmado)) throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave);
    } catch { setMensagem("Informação salva; contate suporte para limpar tentativa local."); return; }
      setPendente(null); setSituacao(""); setConfirmacao(null); setMensagem("Disponibilidade informada. Esta informação não comprova conferência física.");
      void cliente.refetchQueries({ queryKey: ["portal-materiais", userId, clienteId, osId], type: "active" }); },
    onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa antes de sair."),
    onSettled: () => { trava.current = false; },
  });
  const recibo = useMutation({ mutationFn: (pedido: PedidoDisponibilidade) => consultarReciboDisponibilidadePortal(pedido, userId, clienteId, osId),
    onSuccess: async (_resultado, confirmado) => { try {
      await cliente.invalidateQueries({ queryKey: ["portal-materiais", userId, clienteId, osId], refetchType: "none" });
      const atual = await supabase.auth.getUser();
      if (atual.error || atual.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(confirmado)) throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave);
      setPendente(null); setSituacao(""); setConfirmacao(null); setMensagem("Registro confirmado. Esta informação não comprova conferência física.");
      void cliente.refetchQueries({ queryKey: ["portal-materiais", userId, clienteId, osId], type: "active" });
    } catch { setMensagem("Recibo confirmado; contate suporte para conferir a tentativa local."); } },
    onError: () => setMensagem("Recibo indisponível. A tentativa pode ainda estar em processamento; contate suporte."),
    onSettled: () => { trava.current = false; },
  });
  function registrar(pedido: PedidoDisponibilidade) {
    if (trava.current) return;
    try {
      const existente = sessionStorage.getItem(chave);
      if (existente !== null && existente !== JSON.stringify(pedido)) throw new Error("Tentativa divergente.");
      if (existente === null && pendente) throw new Error("Tentativa ausente.");
      if (existente === null) sessionStorage.setItem(chave, JSON.stringify(pedido));
    } catch { setMensagem("Não foi possível preservar a tentativa; informação não enviada. Contate suporte."); return; }
    setPendente(pedido); setMensagem(""); trava.current = true; enviar.mutate(pedido);
  }
  return <div className="mt-3 rounded-lg border border-line p-3">
    <p>Responsável: {item.responsavel === "cliente" ? "Cliente" : "Sinérgica"} · Situação: {item.estado.replaceAll("_", " ")}</p>
    {item.ultima_informacao_em && <p>Última informação: {new Date(item.ultima_informacao_em).toLocaleString("pt-BR")} · {item.ultima_informacao_por === null ? "autor não informado" : item.ultima_informacao_por.toLowerCase() === userId.toLowerCase() ? "informada por você" : "informada por outra pessoa"}.</p>}
    {item.excecao_atual && <p role="status">Foi informada uma exceção em campo; confira a situação com a equipe.</p>}
    {item.excecao_atual && import.meta.env.VITE_SSO_PORTAL_CLASSIFICACAO_EXCECAO_ENABLED === "true" &&
      <ClassificacaoExcecao userId={userId} clienteId={clienteId} osId={osId} listaId={item.id} revisao={item.revisao} />}
    <ul>{item.linhas.map((linha, indice) => <li key={`${item.id}-${indice}`}>{linha.descricao}{linha.quantidade ? ` — ${linha.quantidade}` : ""}{linha.unidade ? ` ${linha.unidade}` : ""}</li>)}</ul>
    <HistoricoMateriais userId={userId} clienteId={clienteId} osId={osId} listaId={item.id} />
    {item.responsavel === "cliente" && revisaoAlterada && <p role="alert">A lista foi atualizada. Confira os materiais e a situação antes de informar disponibilidade. <button type="button" disabled={!!pendente || enviar.isPending} onClick={() => setRevisaoConferida(item.revisao)}>Conferi a lista atual</button></p>}
    {item.responsavel === "cliente" && <form onSubmit={(e) => { e.preventDefault(); if (situacao && confirmacao === fotografia && !revisaoAlterada && !pendente && !enviar.isPending && !trava.current)
      registrar(validarPedidoDisponibilidade({ requestId: crypto.randomUUID(), listaId: item.id, expectedRevision: item.revisao, situacao })); }}>
      <label>Disponibilidade <select required disabled={revisaoAlterada || !!pendente || enviar.isPending} value={situacao} onChange={(e) => { setSituacao(e.target.value as PedidoDisponibilidade["situacao"] | ""); setConfirmacao(null); }}>
        <option value="">Selecione</option>
        <option value="informada_disponivel">Disponível</option><option value="parcial">Parcial</option><option value="indisponivel">Indisponível</option>
      </select></label>
      <label><input type="checkbox" checked={!!situacao && confirmacao === fotografia} disabled={!situacao || revisaoAlterada || !!pendente || enviar.isPending} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi a lista e a disponibilidade informada.</label>
      <button disabled={!situacao || confirmacao !== fotografia || revisaoAlterada || !!pendente || enviar.isPending} type="submit">Informar</button>
    </form>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending || recibo.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {import.meta.env.VITE_SSO_RECIBO_DISPONIBILIDADE_MATERIAIS_ENABLED === "true" && pendente && pendente !== "invalido" &&
      <button type="button" disabled={enviar.isPending || recibo.isPending} onClick={() => {
        if (trava.current) return;
        try { if (sessionStorage.getItem(chave) !== JSON.stringify(pendente)) throw new Error("Tentativa alterada."); }
        catch { setMensagem("Tentativa local alterada. Contate suporte."); return; }
        trava.current = true; setMensagem(""); recibo.mutate(pendente);
      }}>Consultar recibo</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </div>;
}

function ClassificacaoExcecao({ userId, clienteId, osId, listaId, revisao }: { userId: string; clienteId: string; osId: string; listaId: string; revisao: number }) {
  const q = useQuery({ queryKey: ["portal-materiais", userId, clienteId, osId, listaId, "classificacao-excecao", revisao], gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_portal_classificar_excecao_material", {
        p_ator_id: userId, p_cliente_id: clienteId, p_os_id: osId, p_lista_id: listaId, p_revisao: revisao,
      }).abortSignal(signal);
      if (error) throw error;
      const resultado = z.object({ listaId: z.string().guid(), revisao: z.number().int().positive(),
        classificacao: z.enum(["faltante", "parcial", "errado", "novo_levantamento", "nao_classificada"]).nullable() }).strict().parse(data);
      if (resultado.listaId.toLowerCase() !== listaId.toLowerCase() || resultado.revisao !== revisao) throw new Error("Lista divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return resultado;
    } });
  const rotulos = { faltante: "Material faltante", parcial: "Material parcial", errado: "Material diferente do necessário",
    novo_levantamento: "Novo levantamento necessário", nao_classificada: "Exceção sem classificação disponível" } as const;
  if (q.isFetching) return <p role="status">Consultando tipo da exceção…</p>;
  if (q.isError) return <p role="alert">Não foi possível consultar o tipo da exceção. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>;
  return q.data?.classificacao ? <p>Tipo informado: {rotulos[q.data.classificacao]}.</p> : null;
}
