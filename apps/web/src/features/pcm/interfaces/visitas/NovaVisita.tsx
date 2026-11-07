import { Button } from "@sinergica/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { validarCriacaoVisita } from "../../application/visitas";
import type { CriarVisita } from "../../application/visitas-gateway";
import { cancelarCriacaoVisita, consultarReciboCriacaoVisita, reservarCriacaoVisita, supabaseVisitasAdapter } from "../../infrastructure/supabase-visitas-adapter";
import { converterHorarioLocal } from "./horario-local";

export function NovaVisita({ userId, clienteId }: { userId: string; clienteId: string }) {
  const chave = `sso-visita-criacao:${userId}:${clienteId}`;
  const queryClient = useQueryClient();
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      return { comando: salvo ? validarCriacaoVisita(JSON.parse(salvo), clienteId) : null, falhou: false };
    } catch { return { comando: null, falhou: true }; }
  });
  const [pendente, setPendente] = useState<CriarVisita | null>(recuperacao.comando);
  const chaveReserva = `sso-visita-reserva:${userId}:${clienteId}`;
  const [reservaPendente, setReservaPendente] = useState<CriarVisita | "invalida" | null>(() => {
    try { const salvo = sessionStorage.getItem(chaveReserva); return salvo ? validarCriacaoVisita(JSON.parse(salvo), clienteId) : null; }
    catch { return "invalida"; }
  });
  const chaveCancelamento = `sso-visita-criacao-cancelamento:${userId}:${clienteId}`;
  const cancelamentoSchema = z.object({ requestId: z.string().guid(), motivo: z.string().min(1).max(2000) }).strict();
  const [cancelamento, setCancelamento] = useState<z.infer<typeof cancelamentoSchema> | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chaveCancelamento); return salvo === null ? null : cancelamentoSchema.parse(JSON.parse(salvo)); }
    catch { return "invalido"; }
  });
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [natureza, setNatureza] = useState<CriarVisita["natureza"]>("extra");
  const [deslocamento, setDeslocamento] = useState("0");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [armazenamentoFalhou, setArmazenamentoFalhou] = useState(false);
  const trava = useRef(false);
  const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const foto = JSON.stringify([userId, clienteId, inicio, fim, natureza, deslocamento, fuso]);
  const fotoAtual = useRef(foto); fotoAtual.current = foto;

  async function enviar(comando: CriarVisita, somenteRecibo = false) {
    if (trava.current || (cancelamento !== null && !somenteRecibo)) return;
    trava.current = true; setOcupado(true); setErro("");
    try {
      const salvo = sessionStorage.getItem(chave);
      if (salvo !== JSON.stringify(comando)) {
        if (!salvo) throw new Error("Pedido pendente indisponível.");
        setPendente(validarCriacaoVisita(JSON.parse(salvo), clienteId));
        setErro("Há outra criação pendente. Confira e tente novamente.");
        trava.current = false; setOcupado(false); return;
      }
    } catch {
      setArmazenamentoFalhou(true); setErro("Não foi possível recuperar o pedido. Consulte o suporte.");
      trava.current = false; setOcupado(false); return;
    }
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(comando)) throw new Error("Sessão ou tentativa alterada.");
      if (somenteRecibo) await consultarReciboCriacaoVisita(userId, comando);
      else await supabaseVisitasAdapter.criar(comando);
      await queryClient.invalidateQueries({ queryKey: ["visitas", userId, clienteId] });
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      if (cancelamento && (cancelamento === "invalido" || cancelamento.requestId !== comando.requestId || sessionStorage.getItem(chaveCancelamento) !== JSON.stringify(cancelamento))) throw new Error("Cancelamento divergente.");
      const reservaSalva = sessionStorage.getItem(chaveReserva);
      if (reservaSalva) {
        const reserva = validarCriacaoVisita(JSON.parse(reservaSalva), clienteId);
        if (JSON.stringify({ ...reserva, requestId: comando.requestId }) !== JSON.stringify(comando)) throw new Error("Reserva divergente.");
      }
      const salvo = sessionStorage.getItem(chave);
      if (salvo === JSON.stringify(comando)) {
        sessionStorage.removeItem(chave); setPendente(null);
      } else throw new Error("Pedido pendente indisponível ou alterado.");
      if (cancelamento) { sessionStorage.removeItem(chaveCancelamento); setCancelamento(null); }
      if (reservaSalva) { sessionStorage.removeItem(chaveReserva); setReservaPendente(null); }
      setAberto(false);
      setMensagem("Rascunho criado. Nenhuma tarefa foi enviada ao Auvo.");
    } catch (falha) {
      try {
        const salvo = sessionStorage.getItem(chave);
        if (salvo !== JSON.stringify(comando)) {
          if (!salvo) throw new Error("Pedido pendente indisponível.");
          setPendente(validarCriacaoVisita(JSON.parse(salvo), clienteId));
          setErro("Há outra criação pendente. Confira e tente novamente.");
          return;
        }
        const codigo = typeof falha === "object" && falha !== null && "code" in falha ? String(falha.code) : "";
        setPendente(comando);
        setErro(codigo === "42501" ? "Permissão indisponível. O pedido permanece pendente para conferência."
          : "Não foi possível confirmar o resultado. Tente a mesma operação novamente ou procure suporte.");
      } catch { setArmazenamentoFalhou(true); setErro("Não foi possível recuperar o pedido. Consulte o suporte."); }
    } finally { trava.current = false; setOcupado(false); }
  }
  async function cancelar(comando: CriarVisita) {
    if (trava.current || cancelamento === "invalido") return;
    trava.current = true; setOcupado(true); setErro("");
    let tentativa = cancelamento;
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(comando)) throw new Error("Sessão ou pedido alterado.");
      if (!tentativa) {
        if (!confirmarCancelamento || sessionStorage.getItem(chaveCancelamento) !== null) throw new Error("Confirmação necessária.");
        tentativa = cancelamentoSchema.parse({ requestId: comando.requestId, motivo: motivoCancelamento.trim() });
        sessionStorage.setItem(chaveCancelamento, JSON.stringify(tentativa)); setCancelamento(tentativa);
      }
      if (tentativa.requestId !== comando.requestId || sessionStorage.getItem(chaveCancelamento) !== JSON.stringify(tentativa)) throw new Error("Cancelamento divergente.");
      const resultado = await cancelarCriacaoVisita(userId, comando, tentativa.motivo);
      await queryClient.invalidateQueries({ queryKey: ["visitas", userId, clienteId] });
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(comando) || sessionStorage.getItem(chaveCancelamento) !== JSON.stringify(tentativa)) throw new Error("Sessão ou tentativa alterada.");
      const reservaSalva = sessionStorage.getItem(chaveReserva);
      if (reservaSalva) {
        const reserva = validarCriacaoVisita(JSON.parse(reservaSalva), clienteId);
        if (JSON.stringify({ ...reserva, requestId: comando.requestId }) !== JSON.stringify(comando)) throw new Error("Reserva divergente.");
      }
      sessionStorage.removeItem(chave); sessionStorage.removeItem(chaveCancelamento);
      if (reservaSalva) { sessionStorage.removeItem(chaveReserva); setReservaPendente(null); }
      setPendente(null); setCancelamento(null); setConfirmarCancelamento(false); setMotivoCancelamento(""); setAberto(false);
      setMensagem(resultado.estado === "criada" ? "A Visita já havia sido criada e foi preservada." : "Tentativa cancelada no servidor; nenhuma Visita foi criada por este pedido.");
    } catch { setErro("Cancelamento não confirmado. Repita a mesma solicitação ou procure suporte antes de iniciar outra."); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function iniciar() {
    if (cancelamento !== null || reservaPendente !== null || trava.current) return;
    setErro(""); setMensagem("");
    trava.current = true; setOcupado(true);
    let pronto: CriarVisita | null = null;
    try {
      let comando: CriarVisita = validarCriacaoVisita({ requestId: crypto.randomUUID(), expectedRevision: 0,
        visitaId: crypto.randomUUID(), clienteId, contratoId: null, areaId: null, localId: null,
        inicioEm: converterHorarioLocal(inicio), fimEm: converterHorarioLocal(fim), fuso, natureza,
        responsavelId: null, deslocamentoMinutos: Number(deslocamento) }, clienteId);
      if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido pendente.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      if (import.meta.env.VITE_SSO_RESERVA_CRIACAO_VISITA_ENABLED === "true") {
        if (sessionStorage.getItem(chaveReserva) !== null) throw new Error("Reserva pendente.");
        sessionStorage.setItem(chaveReserva, JSON.stringify(comando));
        setReservaPendente(comando);
        comando = await reservarCriacaoVisita(userId, comando);
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || fotoAtual.current !== foto || sessionStorage.getItem(chave) !== null) throw new Error("Sessão ou tentativa alterada.");
      sessionStorage.setItem(chave, JSON.stringify(comando));
      setPendente(comando);
      if (sessionStorage.getItem(chaveReserva) !== null) { sessionStorage.removeItem(chaveReserva); setReservaPendente(null); }
      pronto = comando;
    } catch (falha) { setErro(falha instanceof RangeError ? "Horário inválido ou repetido na mudança de fuso. Escolha outro horário." : "Não foi possível preparar a Visita. Confira os dados, a sessão e a disponibilidade da reserva."); }
    finally { trava.current = false; setOcupado(false); }
    if (pronto) void enviar(pronto);
  }
  async function recuperarReserva(comando: CriarVisita) {
    if (trava.current || pendente || cancelamento !== null) return;
    trava.current = true; setOcupado(true); setErro("");
    let pronto: CriarVisita | null = null;
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(chaveReserva) !== JSON.stringify(comando) || sessionStorage.getItem(chave) !== null) throw new Error("Sessão ou tentativa alterada.");
      const reservado = await reservarCriacaoVisita(userId, comando);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || sessionStorage.getItem(chaveReserva) !== JSON.stringify(comando) || sessionStorage.getItem(chave) !== null) throw new Error("Sessão ou tentativa alterada.");
      sessionStorage.setItem(chave, JSON.stringify(reservado));
      setPendente(reservado);
      sessionStorage.removeItem(chaveReserva); setReservaPendente(null);
      pronto = reservado;
    } catch { setErro("Reserva não confirmada. Repita a recuperação desta mesma Visita ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
    if (pronto) void enviar(pronto);
  }
  return <section aria-label="Nova Visita" className="space-y-2">
    {recuperacao.falhou && <p role="alert">Não foi possível recuperar pedido anterior. Consulte o suporte antes de continuar.</p>}
    {reservaPendente === "invalida" && <p role="alert">Reserva local ilegível. Consulte o suporte antes de continuar.</p>}
    {reservaPendente && reservaPendente !== "invalida" && !pendente && <><p>Há uma reserva de Visita a recuperar. Nenhuma nova tentativa será iniciada até resolver esta reserva.</p><Button variant="secondary" disabled={ocupado || cancelamento !== null} onClick={() => void recuperarReserva(reservaPendente)}>Recuperar mesma reserva</Button></>}
    {erro && <p role="alert">{erro}</p>}{mensagem && <output>{mensagem}</output>}
    {cancelamento === "invalido" || (cancelamento && (!pendente || cancelamento.requestId !== pendente.requestId)) ? <p role="alert">Cancelamento local inconsistente. Consulte suporte.</p> : null}
    {pendente && <><Button variant="secondary" disabled={ocupado || armazenamentoFalhou || cancelamento !== null} onClick={() => void enviar(pendente)}>Tentar criar Visita novamente</Button>
      {import.meta.env.VITE_SSO_RECIBO_CRIACAO_VISITA_ENABLED === "true" && <Button variant="secondary" disabled={ocupado || armazenamentoFalhou} onClick={() => void enviar(pendente, true)}>Consultar recibo sem recriar</Button>}</>}
    {pendente && cancelamento !== "invalido" && import.meta.env.VITE_SSO_CANCELAR_CRIACAO_VISITA_ENABLED === "true" && (cancelamento ?
      <Button variant="secondary" disabled={ocupado} onClick={() => void cancelar(pendente)}>Consultar ou repetir cancelamento</Button> :
      <fieldset disabled={ocupado}><legend>Cancelar tentativa de criação</legend><p>Se a Visita já existir, ela será preservada. Caso contrário, este pedido não poderá criá-la depois.</p>
        <label>Motivo <textarea maxLength={2000} value={motivoCancelamento} onChange={e => { setMotivoCancelamento(e.target.value); setConfirmarCancelamento(false); }} /></label>
        <label><input type="checkbox" checked={confirmarCancelamento} onChange={e => setConfirmarCancelamento(e.target.checked)} /> Conferi o pedido e o motivo.</label>
        <button type="button" disabled={!confirmarCancelamento || !motivoCancelamento.trim()} onClick={() => void cancelar(pendente)}>Cancelar tentativa</button></fieldset>)}
    {!aberto && !pendente && reservaPendente === null && cancelamento === null && !recuperacao.falhou && !armazenamentoFalhou && <Button variant="secondary" onClick={() => { setAberto(true); setErro(""); }}>Nova Visita</Button>}
    {aberto && !pendente && reservaPendente === null && cancelamento === null && !recuperacao.falhou && !armazenamentoFalhou && <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void iniciar(); }}>
      <fieldset disabled={ocupado}>
      <p>O rascunho não inclui contrato, posição, responsável, OS ou equipe; essas informações devem ser completadas antes da confirmação.</p>
      <p>Horários no fuso do dispositivo: {fuso}.</p>
      <label className="block">Início da Visita <input className="input" type="datetime-local" required value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
      <label className="block">Fim da Visita <input className="input" type="datetime-local" required value={fim} onChange={(e) => setFim(e.target.value)} /></label>
      <label className="block">Natureza da Visita <select className="input" value={natureza} onChange={(e) => setNatureza(e.target.value as CriarVisita["natureza"])}>
        <option value="extra">Extra</option><option value="regular">Regular</option><option value="reposicao_manual">Reposição manual</option>
      </select></label>
      <label className="block">Deslocamento em minutos <input className="input" type="number" min="0" step="1" required value={deslocamento} onChange={(e) => setDeslocamento(e.target.value)} /></label>
      <Button type="submit" disabled={ocupado}>Salvar rascunho de Visita</Button>{" "}
      <Button type="button" variant="secondary" disabled={ocupado} onClick={() => setAberto(false)}>Cancelar</Button>
      </fieldset>
    </form>}
  </section>;
}
