import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@sinergica/ui";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const campos = z.object({ titulo: z.string().nullable(), descricao: z.string().nullable(), tecnicoAuvoId: z.string().nullable(),
  dataAgendada: z.string().nullable(), checkIn: z.string().nullable(), checkOut: z.string().nullable() }).strict();
const previaSchema = z.object({ clienteId: z.string().guid(), osId: z.string().guid(), envelopeId: z.string().guid(),
  ordemExterna: z.string().regex(/^[1-9]\d{0,17}$/), revisao: z.number().int().nonnegative().safe(), atual: campos, declarado: campos,
  tecnicoAtualId: z.string().guid().nullable(), tecnicoDeclaradoId: z.string().guid().nullable(), tecnicoAmbiguo: z.boolean(),
  aplicavel: z.boolean(), aplicacaoAutomatica: z.boolean(), statusAlterado: z.literal(false), validacaoPcmComprovada: z.literal(false) }).strict();
const pedidoSchema = z.object({ requestId: z.string().guid(), clienteId: z.string().guid(), osId: z.string().guid(),
  envelopeId: z.string().guid(), ordemExterna: z.string().regex(/^[1-9]\d{0,17}$/), revisao: z.number().int().nonnegative().safe(),
  tecnicoEsperado: z.string().guid().nullable(), motivo: z.string().trim().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; osId: string };
const rotulos: [keyof z.infer<typeof campos>, string][] = [["titulo", "Título"], ["descricao", "Descrição"], ["tecnicoAuvoId", "Técnico no Auvo"],
  ["dataAgendada", "Agendamento"], ["checkIn", "Entrada"], ["checkOut", "Saída"]];

export function ConferenciaEventoCampo(props: Props) {
  if (import.meta.env.VITE_SSO_CONFERENCIA_EVENTO_CAMPO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.osId])} {...props} />;
}
function Conteudo({ userId, clienteId, osId }: Props) {
  const chave = `sso-conferencia-evento-campo:${JSON.stringify([userId, clienteId, osId])}`;
  const cache = useQueryClient(), trava = useRef(false);
  const [aberto, setAberto] = useState(false), [motivo, setMotivo] = useState(""), [confirmacao, setConfirmacao] = useState<string | null>(null), [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try {
    const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
    const p = pedidoSchema.parse(JSON.parse(salvo)); return p.clienteId === clienteId && p.osId === osId ? p : "invalido";
  } catch { return "invalido"; } });
  async function sessao(signal?: AbortSignal) { const r = await supabase.auth.getUser();
    if (r.error || r.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada."); }
  const previa = useQuery({ queryKey: ["conferencia-evento-campo", userId, clienteId, osId], enabled: aberto, retry: false, gcTime: 0,
    queryFn: async ({ signal }) => { await sessao(signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_previa_conferencia_evento_campo", { p_ator_id: userId, p_cliente_id: clienteId, p_os_id: osId }).abortSignal(signal);
      if (error) throw error; const r = previaSchema.parse(data);
      if (r.clienteId.toLowerCase() !== clienteId.toLowerCase() || r.osId.toLowerCase() !== osId.toLowerCase()) throw new Error("Contexto divergente.");
      await sessao(signal); return r; } });
  const foto = previa.data && !previa.isFetching && !previa.isError ? JSON.stringify([userId, clienteId, osId, previa.data, motivo.trim()]) : null;
  const envio = useMutation({ mutationFn: async (p: Pedido) => { await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_confirmar_evento_campo_pcm", { p_ator_id: userId, p_request_id: p.requestId,
      p_cliente_id: p.clienteId, p_os_id: p.osId, p_envelope_id: p.envelopeId, p_ordem: p.ordemExterna, p_revisao: p.revisao, p_tecnico_esperado: p.tecnicoEsperado, p_motivo: p.motivo });
    if (error) throw error;
    const r = z.object({ estado: z.literal("aplicado"), requestId: z.string().guid(), atorId: z.string().guid(), clienteId: z.string().guid(),
      osId: z.string().guid(), envelopeId: z.string().guid(), ordemExterna: z.string(), validacaoPcmComprovada: z.literal(false), chamadoAlterado: z.literal(false), statusAlterado: z.literal(false) }).passthrough().parse(data);
    if (r.requestId !== p.requestId || r.atorId !== userId || r.clienteId !== p.clienteId || r.osId !== p.osId || r.envelopeId !== p.envelopeId || r.ordemExterna !== p.ordemExterna) throw new Error("Recibo divergente.");
    await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
  }, onSuccess: async (_r, p) => { try { await cache.invalidateQueries({ queryKey: ["estado-origem-campo", userId, clienteId], refetchType: "none" });
    await cache.invalidateQueries({ queryKey: ["conferencia-evento-campo", userId, clienteId, osId], refetchType: "none" });
    await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error(); sessionStorage.removeItem(chave);
  } catch { setAviso("Aplicação confirmada, mas a tentativa local mudou. Consulte suporte."); return; }
    setPendente(null); setMotivo(""); setConfirmacao(null); setAviso("Dados de origem aplicados. A OS e a execução ainda exigem as validações próprias.");
    void cache.refetchQueries({ queryKey: ["conferencia-evento-campo", userId, clienteId, osId], type: "active" });
  }, onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte antes de outra decisão."), onSettled: () => { trava.current = false; } });
  function enviar(p: Pedido) { if (trava.current) return; try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
    trava.current = true; envio.mutate(p); } catch { setAviso("Tentativa local indisponível ou divergente. Consulte suporte."); } }
  function confirmar() { if (!foto || confirmacao !== foto || (!previa.data?.aplicavel || previa.data.tecnicoAmbiguo) || pendente || trava.current) return;
    try { const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), clienteId, osId, envelopeId: previa.data.envelopeId,
      ordemExterna: previa.data.ordemExterna, revisao: previa.data.revisao, tecnicoEsperado: previa.data.tecnicoDeclaradoId, motivo: motivo.trim() });
      if (sessionStorage.getItem(chave) !== null) throw new Error(); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
    } catch { setAviso("Informe o motivo e confira a tentativa local; nada foi enviado."); } }
  return <section aria-label="Conferência de dados de origem">
    <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar conferência" : "Conferir dados de origem"}</button>
    {aberto && <><p>Compare os campos atuais da OS com o último evento aceito. A confirmação não muda status, validação do PCM ou Chamado.</p>
      {previa.isFetching && <output>Consultando dados…</output>}{previa.isError && <p role="alert">Conferência indisponível. <button type="button" onClick={() => void previa.refetch()}>Tentar novamente</button></p>}
      {previa.data && !previa.isFetching && !previa.isError && <><p>Evento {previa.data.ordemExterna} · revisão da OS {previa.data.revisao}</p>
        <p>{previa.data.aplicacaoAutomatica ? "Atualizações futuras seguem as regras de proteção contra edição da OS." : "Esta OS já existia; atualizações de campo exigem conferência PCM."}</p>
        <DataTable<(typeof rotulos)[number]> itens={rotulos} chaveLinha={(item) => item[0]} vazio="Nenhum campo para comparar." colunas={[{ chave: "campo", cabecalho: "Campo", cabecalhoLinha: true, render: (item) => item[1] }, { chave: "atual", cabecalho: "Atual na OS", render: (item) => previa.data?.atual[item[0]] ?? "Não informado" }, { chave: "declarado", cabecalho: "Declarado em campo", render: (item) => previa.data?.declarado[item[0]] ?? "Não informado" }]} />
        <p>Técnico vinculado atualmente: {previa.data.tecnicoAtualId ?? "não informado"}. Técnico encontrado para a declaração: {previa.data.tecnicoDeclaradoId ?? "não encontrado"}.</p>
        {previa.data.tecnicoAmbiguo && <p role="alert">Mais de um técnico corresponde à declaração; corrija o cadastro antes de confirmar.</p>}
        {!previa.data.aplicavel && <p>Não há evento posterior disponível para aplicar.</p>}
        {!pendente && <fieldset disabled={envio.isPending || !previa.data.aplicavel || previa.data.tecnicoAmbiguo}><label>Motivo da decisão <textarea maxLength={1000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
          <label><input type="checkbox" checked={!!foto && confirmacao === foto} onChange={(e) => setConfirmacao(e.target.checked ? foto : null)} /> Conferi os campos e autorizo aplicar os dados declarados.</label>
          <button type="button" disabled={!foto || confirmacao !== foto || !motivo.trim()} onClick={confirmar}>Aplicar dados conferidos</button></fieldset>}</>}
    </>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir mesma decisão</button>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
