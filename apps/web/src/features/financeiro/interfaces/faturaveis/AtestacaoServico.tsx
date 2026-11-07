import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().guid();
const pedidoSchema = z.object({ requestId: uuid, cliente: uuid, fato: uuid, revisao: z.number().int().nonnegative().safe(),
  acao: z.enum(["confirmar", "retirar"]), motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const estadoSchema = z.object({ clienteId: uuid, fatoId: uuid, revision: z.number().int().nonnegative().safe(),
  estado: z.enum(["confirmada", "retirada"]).nullable(), revisaoPcmId: uuid, revisaoPcmAtual: z.boolean(),
  execucaoFisicaComprovada: z.literal(false), exclusividadeComprovada: z.literal(false), geraFaturavel: z.literal(false) }).strict();
async function sessao(usuario: string, signal?: AbortSignal) {
  const r = await supabase.auth.getUser();
  if (r.error || r.data.user?.id !== usuario || signal?.aborted) throw new Error("Sessão alterada.");
}

export function AtestacaoServico(props: { usuario: string; cliente: string; declaracao: string }) {
  if (import.meta.env.VITE_SSO_ATESTACAO_SERVICO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.declaracao])} {...props} />;
}
function Conteudo({ usuario, cliente, declaracao }: { usuario: string; cliente: string; declaracao: string }) {
  const chave = `sso-atestacao-servico:${JSON.stringify([usuario, cliente, declaracao])}`;
  const cache = useQueryClient(); const trava = useRef(false);
  const [ocupado, setOcupado] = useState(false); const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw)); return p.cliente === cliente ? p : "invalido"; }
    catch { return "invalido"; }
  });
  const consulta = useQuery({ queryKey: ["atestacao-servico", usuario, cliente, declaracao], gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      await sessao(usuario, signal);
      const origem = await supabase.schema("financeiro").rpc("sso_consultar_fato_execucao_mediado", { p_cliente_id: cliente, p_declaracao_id: declaracao }).abortSignal(signal);
      if (origem.error) throw origem.error;
      const fatos = z.array(z.object({ fato_id: uuid }).strict()).max(1).parse(origem.data);
      await sessao(usuario, signal); if (!fatos.length) return null;
      const r = await supabase.schema("financeiro").rpc("sso_consultar_atestacao_servico", { p_cliente_id: cliente, p_fato_id: fatos[0]!.fato_id }).abortSignal(signal);
      if (r.error) throw r.error;
      const estado = estadoSchema.parse(r.data);
      if (estado.clienteId !== cliente || estado.fatoId !== fatos[0]!.fato_id) throw new Error("Identidade divergente.");
      await sessao(usuario, signal); return estado;
    } });
  const atual = !consulta.isFetching && !consulta.isError ? consulta.data : undefined;
  const acao = atual?.estado === "confirmada" ? "retirar" : "confirmar";
  const foto = JSON.stringify([usuario, cliente, declaracao, atual, acao, motivo.trim()]);
  async function enviar(p: Pedido) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso("");
    try {
      await sessao(usuario); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      const { data, error } = await supabase.schema("financeiro").rpc("sso_alterar_atestacao_servico", { p_request_id: p.requestId,
        p_cliente_id: p.cliente, p_fato_id: p.fato, p_expected_revision: p.revisao, p_acao: p.acao, p_motivo: p.motivo });
      if (error) throw error;
      const r = z.object({ requestId: uuid, clienteId: uuid, fatoId: uuid, revision: z.number().int().positive().safe(), estado: z.enum(["confirmada", "retirada"]),
        revisaoPcmId: uuid, execucaoFisicaComprovada: z.literal(false), exclusividadeComprovada: z.literal(false), geraFaturavel: z.literal(false) }).strict().parse(data);
      if (r.requestId !== p.requestId || r.clienteId !== p.cliente || r.fatoId !== p.fato || r.revision !== p.revisao + 1 || r.estado !== (p.acao === "confirmar" ? "confirmada" : "retirada")) throw new Error("Resposta divergente.");
      await sessao(usuario); await cache.invalidateQueries({ queryKey: ["atestacao-servico", usuario, cliente, declaracao] });
      await sessao(usuario); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setMotivo("");
      setAviso("Atestação registrada; não houve criação de faturável ou cobrança.");
    } catch { setAviso("Resultado não confirmado. Preserve a tentativa e repita o mesmo pedido ou consulte suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (!atual || pendente || ocupado || confirmacao !== foto || !motivo.trim() || (acao === "confirmar" && !atual.revisaoPcmAtual)) return;
    try {
      const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), cliente, fato: atual.fatoId, revisao: atual.revision, acao, motivo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setAviso("Não foi possível guardar a tentativa; nada foi enviado."); }
  }
  return <section aria-label="Atestação PCM do serviço"><h5>Atestação PCM do serviço</h5>
    <p>Declaração responsável, não prova independente da execução. Não comprova exclusividade nem libera faturamento.</p>
    {consulta.isFetching && <output>Consultando fato e revisão…</output>}
    {consulta.isError && <p role="alert">Atestação indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {atual === null && <p>Identidade interna ainda não registrada.</p>}
    {atual && <p>Estado: {atual.estado ?? "sem atestação"} · revisão {atual.revision} · revisão PCM {atual.revisaoPcmAtual ? "atual e aprovada" : "não atual ou não aprovada"}.</p>}
    {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</button> : !pendente && atual && <>
      <label>Motivo <textarea value={motivo} maxLength={2000} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      <label><input type="checkbox" checked={confirmacao === foto} disabled={ocupado || (acao === "confirmar" && !atual.revisaoPcmAtual)} onChange={(e) => setConfirmacao(e.target.checked ? foto : null)} /> Conferi fato, revisão PCM e decisão.</label>
      <button type="button" disabled={ocupado || !motivo.trim() || confirmacao !== foto || (acao === "confirmar" && !atual.revisaoPcmAtual)} onClick={iniciar}>{acao === "confirmar" ? "Atestar execução" : "Retirar atestação"}</button>
    </>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
