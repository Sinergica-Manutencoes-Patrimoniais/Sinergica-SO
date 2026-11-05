import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ExcecaoVisita } from "./ExcecaoVisita";

const uuid = z.string().uuid();
const dataCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const linha = z.object({ visita_id: uuid, semana_origem: dataCivil, regra_origem_id: uuid,
  inicio_em: z.string().datetime({ offset: true }), estado: z.string(), revisao: z.number().int().positive(),
  data_proposta: dataCivil, classificacao: z.enum(["data_proposta_antes_vigencia", "candidata_revisao", "preservar_e_conferir"]),
  feriado_declarado: z.boolean().optional(), ocorrencia_preparada: z.boolean().optional() }).strict();
const pedidoSchema = z.object({ requestId: uuid, atorId: uuid, clienteId: uuid, serieId: uuid, regraNovaId: uuid,
  expectedRevision: z.number().int().positive(), diaSemana: z.number().int().min(1).max(7), vigencia: dataCivil,
  revisoes: z.array(z.object({ visitaId: uuid, revisao: z.number().int().positive(), feriadoEsperado: z.boolean().optional(), ocorrenciaEsperada: z.boolean().optional() }).strict()
    .refine((x) => (x.feriadoEsperado === undefined) === (x.ocorrenciaEsperada === undefined))).max(500), tentativaIncerta: z.boolean().optional() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Cursor = { semana: string; id: string } | null;

export function AlterarDiaComVisitas({ userId, clienteId, serieId, revisao, dia, vigencia, bloqueado }: {
  userId: string; clienteId: string; serieId: string; revisao: number; dia: number; vigencia: string; bloqueado: boolean;
}) {
  const chave = `sso-mudanca-dia-visitas:${JSON.stringify([userId, clienteId, serieId])}`;
  const [pedido, setPedido] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.atorId === userId && p.clienteId === clienteId && p.serieId === serieId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [visitaExcecao, setVisitaExcecao] = useState<string | null>(null);
  const trava = useRef(false);
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const cache = useQueryClient();
  const conferirImpactos = import.meta.env.VITE_SSO_PREVIA_IMPEDIMENTOS_DIA_ENABLED === "true";
  async function conferirAtor() { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId || !montado.current) throw new Error("Sessão alterada"); }
  const consulta = useInfiniteQuery({
    queryKey: ["calendario-mudanca-atomica", userId, clienteId, serieId, revisao, dia, vigencia],
    initialPageParam: null as Cursor, gcTime: 0, retry: false,
    enabled: !pedido && !bloqueado && Number.isInteger(dia) && dia >= 1 && dia <= 7 && dataCivil.safeParse(vigencia).success,
    queryFn: async ({ pageParam, signal }) => {
      await conferirAtor();
      const { data, error } = await supabase.schema("pcm").rpc(conferirImpactos ? "sso_prever_impedimentos_mudanca_dia" : "sso_prever_mudanca_dia", { p_ator_id: userId, p_cliente_id: clienteId,
        p_serie_id: serieId, p_expected_revision: revisao, p_vigencia: vigencia, p_dia_semana: dia,
        p_apos_semana: pageParam?.semana ?? null, p_apos_id: pageParam?.id ?? null, p_limite: 100 }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(100).parse(data); let anterior = pageParam;
      if (conferirImpactos && pagina.some((x) => x.feriado_declarado === undefined || x.ocorrencia_preparada === undefined)) throw new Error("Impactos ausentes");
      for (const item of pagina) {
        if (anterior && (item.semana_origem < anterior.semana || (item.semana_origem === anterior.semana && item.visita_id <= anterior.id))) throw new Error("Página divergente");
        anterior = { semana: item.semana_origem, id: item.visita_id };
      }
      await conferirAtor(); if (signal.aborted) throw new Error("Consulta cancelada"); return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 100 ? { semana: pagina[pagina.length - 1]!.semana_origem, id: pagina[pagina.length - 1]!.visita_id } : undefined,
  });
  const itens = consulta.data?.pages.flat() ?? [];
  const completa = !!consulta.data && !consulta.hasNextPage && !consulta.isFetching && !consulta.isError && itens.length <= 500;
  const candidatas = itens.filter((v) => v.classificacao === "candidata_revisao");
  const revisoes = candidatas.map((v) => ({ visitaId: v.visita_id, revisao: v.revisao,
    ...(conferirImpactos ? { feriadoEsperado: v.feriado_declarado, ocorrenciaEsperada: v.ocorrencia_preparada } : {}) })).sort((a, b) => a.visitaId.localeCompare(b.visitaId));
  const fotografia = JSON.stringify({ userId, clienteId, serieId, revisao, dia, vigencia, itens });
  async function enviar(p: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setAviso("");
    let serializado = JSON.stringify(p);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const jaIncerta = p.tentativaIncerta !== false; p = pedidoSchema.parse({ ...p, tentativaIncerta: true });
      serializado = JSON.stringify(p); sessionStorage.setItem(chave, serializado); setPedido(p);
      const { data, error } = await supabase.schema("pcm").rpc("sso_alterar_dia_com_visitas", {
        p_request_id: p.requestId, p_ator_id: p.atorId, p_cliente_id: p.clienteId, p_serie_id: p.serieId, p_regra_nova_id: p.regraNovaId,
        p_expected_revision: p.expectedRevision, p_dia_semana: p.diaSemana, p_vigencia: p.vigencia, p_revisoes: p.revisoes,
      });
      if (error) {
        if (!jaIncerta && error.code === "P0018" && ["revisao_obsoleta", "fotografia_visitas_alterada", "impactos_alterados"].includes(error.message)) {
          await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
          sessionStorage.removeItem(chave); setPedido(null); setConfirmacao(null);
          setAviso("Regra ou Visitas mudaram. Confira novamente todas as páginas; nenhuma alteração foi aplicada nesta tentativa.");
          void consulta.refetch(); return;
        }
        throw error;
      }
      const recebido = z.object({ requestId: uuid, serieId: uuid, regraId: uuid, revision: z.number().int().positive(),
        visitasMovidas: z.number().int().nonnegative(), visitasSuprimidas: z.number().int().nonnegative().optional(), efeitoRemoto: z.literal(false) }).strict().parse(data);
      if (recebido.requestId !== p.requestId || recebido.serieId !== p.serieId || recebido.regraId !== p.regraNovaId ||
          recebido.revision !== p.expectedRevision + 1 || recebido.visitasMovidas + (recebido.visitasSuprimidas ?? 0) !== p.revisoes.length) throw new Error("Recibo divergente");
      await conferirAtor(); await cache.invalidateQueries({ queryKey: ["calendario-contratual", userId, clienteId] });
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPedido(null); setConfirmacao(null);
      setAviso(`Regra alterada: ${recebido.visitasMovidas} Visita(s) movida(s), ${recebido.visitasSuprimidas ?? 0} suprimida(s), sem envio externo.`);
    } catch { if (montado.current) setAviso("Resultado não confirmado. Preserve e repita o mesmo pedido ou procure suporte; não inicie outra alteração."); }
    finally { trava.current = false; if (montado.current) setOcupado(false); }
  }
  function iniciar() {
    if (pedido || bloqueado || trava.current || !completa || confirmacao !== fotografia) return;
    try {
      const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), atorId: userId, clienteId, serieId, regraNovaId: crypto.randomUUID(),
        expectedRevision: revisao, diaSemana: dia, vigencia, revisoes, tentativaIncerta: false });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPedido(p); void enviar(p);
    } catch { setAviso("Não foi possível guardar o pedido. Nada foi enviado."); }
  }
  return <section aria-label="Mudança de dia com Visitas">
    <h4>Alterar regra e Visitas elegíveis</h4>
    <p>Confira todas as páginas. Confirmadas e reprogramadas são preservadas. Se indicada, Visita em feriado poderá ser suprimida; ocorrências ou vínculos podem exigir reconciliação.</p>
    {bloqueado && <p role="alert">Conclua a tentativa anterior antes de iniciar outra.</p>}
    {pedido === "invalido" ? <p role="alert">Pedido guardado inválido. Procure suporte.</p> : pedido ? <>
      <p>Pedido pendente; seu resultado pode ser incerto.</p><button type="button" disabled={ocupado} onClick={() => void enviar(pedido)}>Repetir mesmo pedido</button>
    </> : <>
      {consulta.isFetching && <p role="status">Consultando Visitas…</p>}
      {consulta.isError && <p role="alert">Não foi possível consultar as Visitas. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
      {consulta.data && !consulta.isError && <><p>{itens.length} Visita(s) carregada(s); {candidatas.length} candidata(s), {itens.length - candidatas.length} para preservar ou conferir.</p>
        <ul>{itens.map((v) => <li key={v.visita_id}>Visita {v.visita_id} · semana {v.semana_origem} · {v.estado} · nova data {v.data_proposta} · {v.classificacao}{v.feriado_declarado && " · feriado: pode ser suprimida"}{v.ocorrencia_preparada && " · ocorrência preparada"}{import.meta.env.VITE_SSO_EXCECAO_VISITA_ENABLED === "true" && <button type="button" disabled={ocupado || bloqueado} onClick={() => setVisitaExcecao(v.visita_id)}>Conferir exceção</button>}</li>)}</ul>
        {visitaExcecao && <ExcecaoVisita userId={userId} clienteId={clienteId} visitaId={visitaExcecao} aoAprovar={() => { setConfirmacao(null); void consulta.refetch(); }} />}
        {consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Carregar mais Visitas</button>}
        {itens.length > 500 && <p role="alert">Mais de 500 Visitas: operação em lote ainda não disponível.</p>}
        <label><input type="checkbox" checked={completa && confirmacao === fotografia} disabled={!completa || ocupado || bloqueado} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi todas as Visitas e a regra apresentada.</label>
        <button type="button" disabled={!completa || ocupado || bloqueado || confirmacao !== fotografia} onClick={iniciar}>Alterar regra e Visitas</button>
      </>}
    </>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
