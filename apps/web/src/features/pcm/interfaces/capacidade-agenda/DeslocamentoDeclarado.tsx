import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const inteiro = z.number().int().nonnegative().safe();
const pedidoSchema = z.object({ requestId: uuid, clienteId: uuid, visitaId: uuid,
  revisaoVisita: inteiro.positive(), revisaoDeclaracao: inteiro, minutos: inteiro.max(10080),
  pessoas: inteiro.max(1000), motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const leituraSchema = z.object({ clienteId: uuid, visitaId: uuid, revisaoVisitaAtual: inteiro.positive(),
  declaracao: z.object({ requestId: uuid, revisao: inteiro.positive(), revisaoVisita: inteiro.positive(),
    minutosPorPessoa: inteiro.max(10080), pessoasProprias: inteiro.max(1000), minutosHomem: inteiro,
    motivo: z.string(), atorId: uuid, criadaEm: z.string() }).strict().nullable(),
  execucaoComprovada: z.literal(false).optional() }).strict();

export function DeslocamentoDeclarado(props: { userId: string; clienteId: string; visitaId: string }) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.visitaId])} {...props} />;
}
function Conteudo({ userId, clienteId, visitaId }: { userId: string; clienteId: string; visitaId: string }) {
  const chave = `sso-deslocamento-visita:${JSON.stringify([userId, clienteId, visitaId])}`;
  const queryKey = ["deslocamento-declarado", userId, clienteId, visitaId];
  const cache = useQueryClient();
  const trava = useRef(false);
  const [minutos, setMinutos] = useState("");
  const [pessoas, setPessoas] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const valor = sessionStorage.getItem(chave); if (!valor) return null;
      const p = pedidoSchema.parse(JSON.parse(valor)); return p.clienteId === clienteId && p.visitaId === visitaId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const consulta = useQuery({ queryKey, gcTime: 0, retry: false, queryFn: async ({ signal }) => {
    const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_deslocamento_visita", { p_cliente_id: clienteId, p_visita_id: visitaId }).abortSignal(signal);
    if (error) throw error;
    const r = leituraSchema.parse(data);
    if (r.clienteId !== clienteId || r.visitaId !== visitaId || (r.declaracao && r.declaracao.minutosHomem !== r.declaracao.minutosPorPessoa * r.declaracao.pessoasProprias)) throw new Error("Declaração divergente.");
    const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
    return r;
  } });
  const historico = useInfiniteQuery({ queryKey: ["historico-deslocamento", userId, clienteId, visitaId], enabled: historicoAberto,
    gcTime: 0, retry: false, initialPageParam: null as number | null, queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_historico_deslocamento", { p_cliente_id: clienteId, p_visita_id: visitaId, p_apos: pageParam, p_limite: 30 }).abortSignal(signal);
      if (error) throw error;
      const registros = z.array(z.object({ revisao: inteiro.positive(), revisao_visita: inteiro.positive(), minutos_por_pessoa: inteiro.max(10080),
        pessoas_proprias: inteiro.max(1000), minutos_homem: inteiro, motivo: z.string().min(1).max(2000), ator_id: uuid, criada_em: z.string() }).strict()).max(30).parse(data);
      let anterior = pageParam ?? Number.MAX_SAFE_INTEGER;
      for (const registro of registros) { if (registro.revisao >= anterior || registro.minutos_homem !== registro.minutos_por_pessoa * registro.pessoas_proprias) throw new Error("Histórico divergente."); anterior = registro.revisao; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return registros;
    }, getNextPageParam: (pagina) => pagina.length === 30 ? pagina.at(-1)?.revisao : undefined });
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    const antes = await supabase.auth.getUser();
    if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_declarar_deslocamento_visita", {
      p_request_id: p.requestId, p_cliente_id: p.clienteId, p_visita_id: p.visitaId, p_revisao_visita: p.revisaoVisita,
      p_revisao_declaracao: p.revisaoDeclaracao, p_minutos: p.minutos, p_pessoas: p.pessoas, p_motivo: p.motivo,
    });
    if (error) throw error;
    const r = z.object({ requestId: uuid, clienteId: uuid, visitaId: uuid, revisaoVisita: inteiro.positive(), revisao: inteiro.positive(),
      minutosPorPessoa: inteiro, pessoasProprias: inteiro, minutosHomem: inteiro, execucaoComprovada: z.literal(false) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.clienteId !== clienteId || r.visitaId !== visitaId || r.revisaoVisita !== p.revisaoVisita || r.revisao !== p.revisaoDeclaracao + 1 || r.minutosPorPessoa !== p.minutos || r.pessoasProprias !== p.pessoas || r.minutosHomem !== p.minutos * p.pessoas) throw new Error("Recibo divergente.");
    const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
  }, onSuccess: async (_data, p) => {
    try { await cache.invalidateQueries({ queryKey }); await cache.invalidateQueries({ queryKey: ["historico-deslocamento", userId, clienteId, visitaId] }); const atual = await supabase.auth.getUser();
      if (atual.error || atual.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setAviso("Declaração registrada. Não comprova execução nem altera a demanda oficial.");
    } catch { setAviso("Recibo recebido, mas a tentativa não pôde ser removida. Confira antes de prosseguir."); }
  }, onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."), onSettled: () => { trava.current = false; } });
  function enviar(p: Pedido) { if (trava.current) return; trava.current = true; envio.mutate(p); }
  const fotografia = JSON.stringify([userId, clienteId, visitaId, consulta.data ?? null, minutos, pessoas, motivo]);
  return <section aria-label="Deslocamento declarado da Visita"><h4>Deslocamento declarado</h4>
    <p>Planejamento informado pelo PCM; não comprova execução e não é somado automaticamente à demanda.</p>
    <button type="button" aria-expanded={historicoAberto} onClick={() => setHistoricoAberto((valor) => !valor)}>{historicoAberto ? "Ocultar histórico" : "Consultar histórico"}</button>
    {historicoAberto && <section aria-label="Histórico de deslocamento declarado">
      {historico.isFetching && <output>Consultando histórico…</output>}
      {historico.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void historico.refetch()}>Tentar novamente</button></p>}
      {!historico.isFetching && !historico.isError && historico.data && <ul>{historico.data.pages.flat().map((item) => <li key={item.revisao}>Revisão {item.revisao} · Visita na revisão {item.revisao_visita} · {item.minutos_por_pessoa} min por pessoa · {item.pessoas_proprias} pessoas · {item.minutos_homem} minutos-homem · {item.motivo} · {item.ator_id} · {item.criada_em}</li>)}</ul>}
      {historico.hasNextPage && <button type="button" disabled={historico.isFetching} onClick={() => void historico.fetchNextPage()}>Mais registros</button>}
    </section>}
    {consulta.isFetching && <output>Consultando declaração…</output>}
    {consulta.isError && <p role="alert">Declaração indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <>
      {consulta.data.declaracao ? <p>Revisão {consulta.data.declaracao.revisao}: {consulta.data.declaracao.minutosPorPessoa} min por pessoa · {consulta.data.declaracao.pessoasProprias} pessoas · {consulta.data.declaracao.minutosHomem} minutos-homem declarados. {consulta.data.declaracao.revisaoVisita !== consulta.data.revisaoVisitaAtual && "A Visita mudou desde a declaração; confira novamente."}</p> : <p>Nenhuma declaração encontrada; deslocamento não é considerado zero.</p>}
      <form onSubmit={(e) => { e.preventDefault(); if (pendente || trava.current || confirmacao !== fotografia || !minutos.trim() || !pessoas.trim()) return;
        const validado = pedidoSchema.safeParse({ requestId: crypto.randomUUID(), clienteId, visitaId, revisaoVisita: consulta.data!.revisaoVisitaAtual,
          revisaoDeclaracao: consulta.data!.declaracao?.revisao ?? 0, minutos: Number(minutos), pessoas: Number(pessoas), motivo });
        if (!validado.success) { setAviso("Confira valores inteiros e motivo."); return; }
        try { if (sessionStorage.getItem(chave) !== null) throw new Error(); sessionStorage.setItem(chave, JSON.stringify(validado.data)); }
        catch { setAviso("Não foi possível guardar a tentativa; nada foi enviado."); return; }
        setPendente(validado.data); enviar(validado.data);
      }}><fieldset disabled={!!pendente || envio.isPending}>
        <label>Minutos por pessoa <input required type="number" min="0" max="10080" step="1" value={minutos} onChange={(e) => setMinutos(e.target.value)} /></label>
        <label>Pessoas próprias <input required type="number" min="0" max="1000" step="1" value={pessoas} onChange={(e) => setPessoas(e.target.value)} /></label>
        <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
        <label><input type="checkbox" checked={confirmacao === fotografia} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi Visita, revisão e dados; não estou afirmando execução.</label>
        <button type="submit" disabled={confirmacao !== fotografia}>Registrar declaração</button>
      </fieldset></form>
    </>}
    {pendente === "invalido" && <p role="alert">Tentativa ilegível. Procure suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir mesma tentativa</button>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
