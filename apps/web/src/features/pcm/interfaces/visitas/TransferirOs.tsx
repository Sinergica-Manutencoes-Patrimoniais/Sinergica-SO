import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { VisitaResumo } from "../../application/visitas-gateway";
import {
  type TransferenciaVisita,
  supabaseTransferenciaVisitaAdapter,
  transferenciaVisitaSchema,
} from "../../infrastructure/supabase-transferencia-visita-adapter";
import { supabaseVisitasAdapter } from "../../infrastructure/supabase-visitas-adapter";
import { supabase } from "../../../../lib/supabase-client";

type Props = { userId: string; clienteId: string; visitas: VisitaResumo[]; bloqueado: boolean };

/** Recursos carregados e o comando são sempre reautorizados pelo servidor. */
export function TransferirOs(props: Props) {
  return <TransferirOsInterna key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}

function TransferirOsInterna({ userId, clienteId, visitas, bloqueado }: Props) {
  const chave = `sso-transferencia-visita:${userId}:${clienteId}`;
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      return { comando: salvo ? transferenciaVisitaSchema.parse(JSON.parse(salvo)) : null, falhou: false };
    } catch {
      return { comando: null, falhou: true };
    }
  });
  const [pendente, setPendente] = useState<TransferenciaVisita | null>(recuperacao.comando);
  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [vinculoId, setVinculoId] = useState("");
  const [sequencia, setSequencia] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  const queryClient = useQueryClient();
  const permitirConfirmadas = import.meta.env.VITE_SSO_TRANSFERENCIA_CONFIRMADA_ENABLED === "true";
  const elegiveis = visitas.filter((v) => v.estado === "rascunho" || v.estado === "planejada" || (permitirConfirmadas && v.estado === "confirmada"));
  const origem = elegiveis.find((v) => v.id === origemId);
  const destino = elegiveis.find((v) => v.id === destinoId && v.id !== origemId);
  const ordens = useInfiniteQuery({
    queryKey: ["visitas", userId, clienteId, "transferencia", origemId],
    enabled: Boolean(origem && !bloqueado && !pendente), gcTime: 0,
    initialPageParam: null as { sequencia: number; id: string } | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const pagina = await supabaseVisitasAdapter.listarOs({ clienteId, visitaId: origemId,
        incluirHistorico: false, limite: 20, apos: pageParam }, signal);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 20
      ? { sequencia: pagina[pagina.length - 1]!.sequencia, id: pagina[pagina.length - 1]!.id } : undefined,
  });
  const vinculos = ordens.data?.pages.flat() ?? [];
  const vinculosDuplicados = new Set(vinculos.map((v) => v.id.toLowerCase())).size !== vinculos.length;
  const vinculo = vinculos.find((v) => v.id === vinculoId);
  const fotografia = origem && destino && vinculo
    ? JSON.stringify([userId, clienteId, origem, destino, vinculo, sequencia, motivo.trim()])
    : null;
  async function consultarRecibo(comando: TransferenciaVisita) {
    if (enviando.current) return;
    enviando.current = true; setOcupado(true); setErro("");
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(comando))
        throw new Error("Sessão ou tentativa alterada.");
      const recibo = await supabaseTransferenciaVisitaAdapter.consultarRecibo(comando, userId, clienteId);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(comando))
        throw new Error("Sessão ou tentativa alterada.");
      if (!recibo.encontrado) {
        setErro("Nenhum recibo disponível. Isso não comprova falha; mantenha a tentativa e consulte o suporte.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["visitas", userId, clienteId] });
      const final = await supabase.auth.getUser();
      if (final.error || final.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(comando))
        throw new Error("Sessão ou tentativa alterada.");
      sessionStorage.removeItem(chave);
      setPendente(null); setVinculoId(""); setMotivo(""); setConfirmacao(null);
      setErro("Transferência registrada anteriormente. Consulte as Visitas atualizadas; o recibo não comprova o vínculo atual.");
    } catch { setErro("Não foi possível consultar o recibo. Mantenha a tentativa ou consulte o suporte."); }
    finally { enviando.current = false; setOcupado(false); }
  }
  async function enviar(comando: TransferenciaVisita) {
    if (enviando.current || bloqueado) return;
    enviando.current = true;
    setOcupado(true);
    setErro("");
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(comando))
        throw new Error("Sessão ou tentativa alterada.");
      await supabaseTransferenciaVisitaAdapter.transferir(comando, userId, clienteId);
      await queryClient.invalidateQueries({ queryKey: ["visitas", userId, clienteId] });
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) throw new Error("Operação guardada divergente.");
      sessionStorage.removeItem(chave);
      setPendente(null);
      setVinculoId("");
      setMotivo("");
      setConfirmacao(null);
    } catch {
      setErro("Não foi possível confirmar a transferência. Repita com o mesmo pedido ou consulte o suporte antes de criar outro.");
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  function iniciar() {
    if (pendente || recuperacao.falhou || bloqueado || !origem || !destino || ordens.isFetching || ordens.isError || vinculosDuplicados
      || !vinculo || !fotografia || confirmacao !== fotografia) return;
    try {
      const comando = transferenciaVisitaSchema.parse({ requestId: crypto.randomUUID(), origemId: origem.id,
        destinoId: destino.id, vinculoId, novoVinculoId: crypto.randomUUID(), revisaoOrigem: origem.revisao,
        revisaoDestino: destino.revisao, sequencia: Number(sequencia), motivo,
        confirmadas: origem.estado === "confirmada" || destino.estado === "confirmada" });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Operação pendente.");
      sessionStorage.setItem(chave, JSON.stringify(comando));
      setPendente(comando);
      void enviar(comando);
    } catch { setErro("Confira os dados, o motivo e o armazenamento antes de continuar."); }
  }
  const rotulo = (visita: VisitaResumo) => `${visita.inicioEm} (${visita.fuso}) — ${visita.estado} — revisão ${visita.revisao}`;
  return (
    <section aria-label="Transferir OS entre Visitas" className="border-t border-line pt-3 space-y-2">
      <h3>Transferir OS entre Visitas</h3>
      <p>Somente Visitas já carregadas no período. Não envia tarefas ao Auvo. {permitirConfirmadas ? "Visitas confirmadas voltarão a planejadas e precisarão de nova confirmação; efeitos remotos conhecidos bloqueiam a transferência." : "Somente rascunho ou planejadas."}</p>
      {recuperacao.falhou && <p role="alert">Operação guardada inválida. Consulte o suporte antes de continuar.</p>}
      {erro && <p role="alert">{erro}</p>}
      {pendente ? <><button type="button" disabled={ocupado || bloqueado} onClick={() => void enviar(pendente)}>Repetir transferência pendente</button>
        {import.meta.env.VITE_SSO_RECIBO_TRANSFERENCIA_VISITA_ENABLED === "true" && <button type="button" disabled={ocupado} onClick={() => void consultarRecibo(pendente)}>Consultar recibo da transferência</button>}</> : !recuperacao.falhou && (
        <form onSubmit={(event) => { event.preventDefault(); iniciar(); }} className="space-y-2">
          <label>Origem <select required value={origemId} onChange={(event) => { setOrigemId(event.target.value); setVinculoId(""); setConfirmacao(null); }}>
            <option value="">Selecione</option>{elegiveis.map((v) => <option key={v.id} value={v.id}>{rotulo(v)}</option>)}
          </select></label>
          <label>Destino <select required value={destinoId} onChange={(event) => { setDestinoId(event.target.value); setConfirmacao(null); }}>
            <option value="">Selecione</option>{elegiveis.filter((v) => v.id !== origemId).map((v) => <option key={v.id} value={v.id}>{rotulo(v)}</option>)}
          </select></label>
          {ordens.isFetching && origem && <output>Carregando OS da origem...</output>}
          {ordens.isError && <p role="alert">Não foi possível carregar as OS. <button type="button" onClick={() => void ordens.refetch()}>Tentar novamente</button></p>}
          {!ordens.isFetching && !ordens.isError && vinculosDuplicados && <p role="alert">OS repetida entre páginas. <button type="button" onClick={() => void ordens.refetch()}>Consultar novamente</button></p>}
          <label>OS <select required disabled={!origem || ordens.isFetching || ordens.isError || vinculosDuplicados} value={vinculoId} onChange={(event) => { setVinculoId(event.target.value); setConfirmacao(null); }}>
            <option value="">Selecione</option>{!vinculosDuplicados && vinculos.map((v) => <option key={v.id} value={v.id}>{v.numero} — {v.titulo}</option>)}
          </select></label>
          {ordens.hasNextPage && !vinculosDuplicados && <button type="button" disabled={ordens.isFetching} onClick={() => void ordens.fetchNextPage()}>Mais OS</button>}
          <label>Sequência no destino <input type="number" min="1" step="1" required value={sequencia} onChange={(event) => { setSequencia(event.target.value); setConfirmacao(null); }} /></label>
          <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(event) => { setMotivo(event.target.value); setConfirmacao(null); }} /></label>
          <label><input type="checkbox" checked={Boolean(fotografia && confirmacao === fotografia)} disabled={!fotografia || ocupado}
            onChange={(event) => setConfirmacao(event.target.checked ? fotografia : null)} /> Conferi a OS, as Visitas, a sequência e o motivo.</label>
          <button type="submit" disabled={bloqueado || ocupado || vinculosDuplicados || !fotografia || confirmacao !== fotografia}>Transferir OS</button>
        </form>
      )}
    </section>
  );
}
