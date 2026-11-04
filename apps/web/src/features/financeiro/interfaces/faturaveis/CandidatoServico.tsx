import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const competencia = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/).refine(x => !x.startsWith("0000"));
const pedidoSchema = z.object({ requestId: uuid, cliente: uuid, declaracao: uuid, fato: uuid, revisao: z.number().int().positive().safe(), competencia }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const atestacao = z.object({ clienteId: uuid, fatoId: uuid, revision: z.number().int().nonnegative().safe(), estado: z.enum(["confirmada", "retirada"]).nullable(), revisaoPcmId: uuid, revisaoPcmAtual: z.boolean(), execucaoFisicaComprovada: z.literal(false), exclusividadeComprovada: z.literal(false), geraFaturavel: z.literal(false) }).strict();

export function CandidatoServico(props: { usuario: string; cliente: string; declaracao: string }) {
  if (import.meta.env.VITE_SSO_CANDIDATO_SERVICO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.declaracao])} {...props} />;
}
function Conteudo({ usuario, cliente, declaracao }: { usuario: string; cliente: string; declaracao: string }) {
  const chave = `candidato-servico:${JSON.stringify([usuario, cliente, declaracao])}`; const cache = useQueryClient(); const trava = useRef(false);
  const [periodo, setPeriodo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw)); return p.cliente === cliente && p.declaracao === declaracao ? p : "invalido"; } catch { return "invalido"; } });
  async function sessao(signal?: AbortSignal) { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== usuario || signal?.aborted) throw new Error("Sessão alterada."); }
  const consulta = useQuery({ queryKey: ["candidato-servico-fonte", usuario, cliente, declaracao], gcTime: 0, retry: false, queryFn: async ({ signal }) => {
    await sessao(signal); const f = await supabase.schema("financeiro").rpc("sso_consultar_fato_execucao_mediado", { p_cliente_id: cliente, p_declaracao_id: declaracao }).abortSignal(signal);
    if (f.error) throw f.error; const fatos = z.array(z.object({ fato_id: uuid }).strict()).max(1).parse(f.data); await sessao(signal); if (!fatos.length) return null;
    const a = await supabase.schema("financeiro").rpc("sso_consultar_atestacao_servico", { p_cliente_id: cliente, p_fato_id: fatos[0]!.fato_id }).abortSignal(signal);
    if (a.error) throw a.error; const estado = atestacao.parse(a.data);
    if (estado.clienteId !== cliente || estado.fatoId !== fatos[0]!.fato_id) throw new Error("Identidade divergente.");
    await sessao(signal); return estado;
  } });
  const atual = !consulta.isFetching && !consulta.isError ? consulta.data : undefined;
  const elegivel = !!atual && atual.estado === "confirmada" && atual.revisaoPcmAtual && atual.revision > 0;
  const dataCompetencia = `${periodo}-01`;
  const foto = JSON.stringify([usuario, cliente, declaracao, atual, dataCompetencia]);
  async function enviar(p: Pedido) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso("");
    try {
      await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido alterado.");
      const { data, error } = await supabase.schema("financeiro").rpc("sso_criar_candidato_servico", { p_request_id: p.requestId, p_cliente_id: p.cliente, p_fato_id: p.fato, p_revisao_atestacao: p.revisao, p_competencia: p.competencia });
      if (error) throw error;
      const r = z.object({ requestId: uuid, itemId: uuid, fatoId: uuid, valorCentavos: z.string().regex(/^\d+$/), competencia, estado: z.literal("pendente"), conferenciaPermitida: z.literal(false), cobrancaCriada: z.literal(false) }).strict().parse(data);
      if (r.requestId !== p.requestId || r.fatoId !== p.fato || r.competencia !== p.competencia) throw new Error("Recibo divergente.");
      await sessao(); await cache.invalidateQueries({ queryKey: ["faturaveis", usuario, cliente], refetchType: "none" }); await sessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido alterado.");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setAviso(`Candidato ${r.itemId} registrado por ${r.valorCentavos} centavos. Conferência ainda bloqueada; nenhuma cobrança criada.`);
    } catch { setAviso("Resultado não confirmado. Preserve a tentativa e repita o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (!atual || !elegivel || !competencia.safeParse(dataCompetencia).success || confirmacao !== foto || pendente || ocupado) return;
    try { const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), cliente, declaracao, fato: atual.fatoId, revisao: atual.revision, competencia: dataCompetencia });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente."); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setAviso("Não foi possível guardar o pedido; nada foi enviado."); }
  }
  return <section aria-label="Candidato de serviço"><h5>Preparar candidato de serviço</h5>
    <p>O servidor verifica proposta, classificação, atestação e conflitos conhecidos. A conferência e a cobrança permanecem bloqueadas; execução e exclusividade global não são comprovadas.</p>
    {consulta.isFetching && <output>Consultando atestação…</output>}
    {consulta.isError && <p role="alert">Origem indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {atual === null && <p>Fato ainda não identificado.</p>}
    {atual && !elegivel && <p>Atestação confirmada e revisão PCM atual são necessárias.</p>}
    {pendente === "invalido" && <p role="alert">Pedido ilegível; procure suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</button> : !pendente && elegivel && <>
      <label>Competência <input type="month" value={periodo} onChange={(e) => { setPeriodo(e.target.value); setConfirmacao(null); }} disabled={ocupado} /></label>
      <label><input type="checkbox" checked={confirmacao === foto} onChange={(e) => setConfirmacao(e.target.checked ? foto : null)} disabled={ocupado || !competencia.safeParse(dataCompetencia).success} /> Conferi a origem, atestação e competência.</label>
      <button type="button" disabled={ocupado || confirmacao !== foto || !competencia.safeParse(dataCompetencia).success} onClick={iniciar}>Criar candidato pendente</button>
    </>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
