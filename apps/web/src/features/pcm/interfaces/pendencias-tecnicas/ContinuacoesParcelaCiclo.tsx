import { Button } from "@sinergica/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { DevolverParcialCiclo } from "./DevolverParcialCiclo";

const id = z.string().guid();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const linhaSchema = z.object({ proposta_id: id, parcela_id: id, os_id: id, chamado_id: id, chamado_revision: z.number().int().positive(),
  descricao_restante: z.string().min(1).max(4000), minutos_restantes: z.number().int().positive(), situacao: z.string(), proposta_sha256: hash, vinculo_declarado_atual: z.boolean() }).strict();
const pedidoSchema = z.object({ requestId: id, atorId: id, clienteId: id, composicaoId: id, cicloId: id, parcelaId: id, propostaId: id,
  chamadoRevision: z.number().int().positive(), propostaSha256: hash, motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const reciboSchema = z.object({ requestId: id, clienteId: id, cicloId: id, parcelaId: id, propostaId: id, osId: id, propostaSha256: hash,
  vinculoDeclarado: z.literal(true), restanteComprovado: z.literal(false), devolucaoAutorizada: z.literal(false) }).strict();

export function ContinuacoesParcelaCiclo({ userId, clienteId, composicaoId, cicloId, parcelaId }: {
  userId: string; clienteId: string; composicaoId: string; cicloId: string; parcelaId: string;
}) {
  const chave = `sso-continuacao-parcela:${userId}:${clienteId}:${cicloId}:${parcelaId}`;
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave); if (!salvo) return { pedido: null, invalido: false };
      const pedido = pedidoSchema.parse(JSON.parse(salvo));
      if (pedido.atorId !== userId || pedido.clienteId !== clienteId || pedido.composicaoId !== composicaoId || pedido.cicloId !== cicloId || pedido.parcelaId !== parcelaId) throw new Error("Contexto divergente");
      return { pedido, invalido: false };
    } catch { return { pedido: null, invalido: true }; }
  });
  const [pendente, setPendente] = useState<Pedido | null>(recuperacao.pedido);
  const [propostaId, setPropostaId] = useState(""); const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState("");
  const trava = useRef(false); const cache = useQueryClient();
  const mediado = import.meta.env.VITE_SSO_VINCULO_CONTINUIDADE_MEDIADO_ENABLED === "true";
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada"); }
  const consulta = useInfiniteQuery({ queryKey: ["backlog-continuacoes-ciclo", userId, clienteId, cicloId], initialPageParam: null as string | null, gcTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ pageParam, signal }) => { await conferirAtor(); const { data, error } = await supabase.schema("pcm").rpc(mediado ? "sso_continuacoes_para_parcela_mediado" : "sso_continuacoes_para_parcela", {
      ...(mediado ? { p_ator_id: userId } : {}), p_cliente_id: clienteId, p_ciclo_id: cicloId, p_apos: pageParam, p_limite: 30 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(linhaSchema).max(30).parse(data); let anterior = pageParam ?? "";
      for (const item of pagina) { if (item.parcela_id !== parcelaId || item.proposta_id <= anterior) throw new Error("Página divergente"); anterior = item.proposta_id; }
      await conferirAtor(); return pagina; }, getNextPageParam: (pagina) => pagina.length === 30 ? pagina.at(-1)?.proposta_id : undefined });
  const paginas = consulta.data?.pages.flat() ?? [];
  const paginasDivergentes = paginas.some((item, indice) => indice > 0 && item.proposta_id <= paginas[indice - 1]!.proposta_id);
  const itens = !consulta.isFetching && !consulta.isError && !paginasDivergentes ? paginas : [];
  const proposta = itens.find((item) => item.proposta_id === propostaId);
  const fotografia = proposta ? JSON.stringify({ proposta, motivo: motivo.trim() }) : null;
  async function enviar(pedido: Pedido) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso(""); const serializado = JSON.stringify(pedido);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("pcm").rpc(mediado ? "sso_vincular_continuacao_parcela_mediado" : "sso_vincular_continuacao_parcela", {
        p_request_id: pedido.requestId, p_ator_esperado: pedido.atorId, p_cliente_id: pedido.clienteId, p_ciclo_id: pedido.cicloId,
        p_parcela_id: pedido.parcelaId, p_proposta_id: pedido.propostaId, p_chamado_revision: pedido.chamadoRevision,
        p_proposta_sha256: pedido.propostaSha256, p_motivo: pedido.motivo });
      if (error) throw error; const r = reciboSchema.parse(data);
      if (r.requestId !== pedido.requestId || r.clienteId !== clienteId || r.cicloId !== cicloId || r.parcelaId !== parcelaId || r.propostaId !== pedido.propostaId || r.propostaSha256 !== pedido.propostaSha256) throw new Error("Recibo divergente");
      await conferirAtor(); await cache.invalidateQueries({ queryKey: ["backlog-continuacoes-ciclo", userId, clienteId, cicloId] }); await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setMotivo(""); setAviso("Vínculo declarado registrado; restante e parada não foram comprovados.");
    } catch { setAviso("Não foi possível confirmar o vínculo. A tentativa permanece guardada; repita somente o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (trava.current || pendente || recuperacao.invalido || !proposta || proposta.situacao !== "pendente" || proposta.vinculo_declarado_atual || !fotografia || confirmacao !== fotografia || consulta.isFetching || consulta.isError || paginasDivergentes) return;
    try {
      const pedido = pedidoSchema.parse({ requestId: crypto.randomUUID(), atorId: userId, clienteId, composicaoId, cicloId, parcelaId,
        propostaId: proposta.proposta_id, chamadoRevision: proposta.chamado_revision, propostaSha256: proposta.proposta_sha256, motivo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(pedido)); setPendente(pedido); void enviar(pedido);
    } catch { setAviso("Não foi possível guardar a tentativa. Confira os dados, motivo e sessão."); }
  }
  return <section aria-label="Continuidade da parcela" className="mt-2 rounded-md border border-line p-3">
    <h5>Continuidade da parcela</h5><p>Vínculo declarado não comprova cobertura do restante nem autoriza devolução.</p>
    {consulta.isFetching && <p role="status">Consultando propostas…</p>}
    {consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {paginasDivergentes && <p role="alert">As propostas mudaram durante a consulta. <button type="button" onClick={() => void consulta.refetch()}>Consultar novamente</button></p>}
    {recuperacao.invalido ? <p role="alert">Tentativa local inválida. Procure suporte.</p> : pendente ? <><p>Pedido pendente para proposta {pendente.propostaId}; a resposta pode ter sido perdida.</p><Button variant="secondary" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</Button></> : <>
      {!consulta.isFetching && !consulta.isError && !paginasDivergentes && consulta.data && itens.length === 0 && <p>Nenhuma proposta encontrada para as OS vinculadas à parcela.</p>}
      <label>Proposta <select className="input" value={propostaId} disabled={ocupado || consulta.isFetching || consulta.isError || paginasDivergentes} onChange={(e) => { setPropostaId(e.target.value); setConfirmacao(null); }}><option value="">Selecione</option>{itens.map((item) => <option key={item.proposta_id} value={item.proposta_id}>{item.descricao_restante} · {item.minutos_restantes} min · {item.situacao}</option>)}</select></label>
      {consulta.hasNextPage && !paginasDivergentes && <Button variant="secondary" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais propostas</Button>}
      {proposta && <p>OS {proposta.os_id} · revisão do Chamado {proposta.chamado_revision}. {proposta.vinculo_declarado_atual ? "Vínculo já declarado para este conteúdo." : "Vínculo ainda não declarado para este conteúdo."}</p>}
      {import.meta.env.VITE_SSO_RETORNO_PARCIAL_CICLO_ENABLED === "true" && proposta && <DevolverParcialCiclo key={`${userId}:${clienteId}:${cicloId}:${parcelaId}:${proposta.proposta_id}`} userId={userId} clienteId={clienteId} composicaoId={composicaoId} cicloId={cicloId} parcelaId={parcelaId} propostaId={proposta.proposta_id} />}
      <label>Motivo <textarea className="input" maxLength={2000} value={motivo} disabled={ocupado} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      {confirmacao && confirmacao !== fotografia && <p role="alert">A proposta ou revisão mudou. Confira novamente.</p>}
      <label><input type="checkbox" checked={Boolean(fotografia && confirmacao === fotografia)} disabled={ocupado || !fotografia} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Declaro o vínculo desta proposta com esta parcela.</label>
      <Button variant="secondary" disabled={ocupado || !proposta || proposta.situacao !== "pendente" || proposta.vinculo_declarado_atual || !fotografia || confirmacao !== fotografia || !motivo.trim()} onClick={iniciar}>Registrar vínculo</Button>
    </>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
