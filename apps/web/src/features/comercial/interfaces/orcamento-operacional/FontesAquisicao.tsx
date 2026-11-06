import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { RetificarFonteAquisicao } from "./RetificarFonteAquisicao";
import { valorReaisParaCentavos } from "../../domain/valor-em-reais";

const uuid = z.string().uuid();
const tipo = z.enum(["material", "retirada_exclusiva"]);
const pedidoSchema = z.object({ atorId: uuid, clienteId: uuid, requestId: uuid, fonteId: uuid, listaId: uuid,
  listaRevision: z.number().int().positive(), tipo, descricao: z.string().trim().min(1).max(1000),
  valorCentavos: z.number().int().safe().nonnegative().max(1_000_000_000_000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const linhaSchema = z.object({ id: uuid, lista_revisao: z.number().int().positive(), tipo, descricao: z.string().min(1).max(1000),
  valor_centavos: z.number().int().safe().nonnegative().max(1_000_000_000_000), criado_em: z.string().datetime({ offset: true }) }).strict();

export function FontesAquisicao({ usuario, cliente, listaId, listaRevisao, permitirEdicao }: {
  usuario: string; cliente: string; listaId: string; listaRevisao: number; permitirEdicao: boolean;
}) {
  const chave = `sso-fonte-aquisicao:${JSON.stringify([usuario, cliente, listaId])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.atorId === usuario && p.clienteId === cliente && p.listaId === listaId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [categoria, setCategoria] = useState<z.infer<typeof tipo> | "">("");
  const [descricao, setDescricao] = useState(""); const [valor, setValor] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(""); const trava = useRef(false); const cache = useQueryClient();
  const raiz = ["orcamento-fontes-aquisicao", usuario, cliente, listaId] as const;
  const fotografia = JSON.stringify({ usuario, cliente, listaId, listaRevisao, categoria, descricao: descricao.trim(), valor });
  const valorCentavos = valorReaisParaCentavos(valor);
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== usuario) throw new Error("Sessão alterada"); }
  const consulta = useInfiniteQuery({ queryKey: raiz, initialPageParam: null as string | null, gcTime: 0, retry: false, enabled: permitirEdicao,
    queryFn: async ({ pageParam, signal }) => {
      await conferirAtor(); const { data, error } = await supabase.schema("comercial").rpc("sso_listar_fontes_aquisicao", {
        p_ator_id: usuario, p_cliente_id: cliente, p_lista_id: listaId, p_apos: pageParam, p_limite: 50,
      }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(linhaSchema).max(50).parse(data); let anterior = pageParam ?? "";
      for (const f of pagina) { if (f.id <= anterior) throw new Error("Página divergente"); anterior = f.id; }
      await conferirAtor(); if (signal.aborted) throw new Error("Consulta cancelada"); return pagina;
    }, getNextPageParam: (p) => p.length === 50 ? p.at(-1)?.id : undefined });
  async function enviar(p: Pedido) {
    if (trava.current || !permitirEdicao) return;
    trava.current = true; setOcupado(true); setAviso(""); const serializado = JSON.stringify(p);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("comercial").rpc("sso_declarar_fonte_aquisicao", {
        p_ator_id: p.atorId, p_cliente_id: p.clienteId, p_request_id: p.requestId, p_fonte_id: p.fonteId,
        p_lista_id: p.listaId, p_lista_revision: p.listaRevision, p_tipo: p.tipo, p_descricao: p.descricao, p_valor_centavos: p.valorCentavos,
      });
      if (error) throw error;
      const r = z.object({ requestId: uuid, clienteId: uuid, fonteId: uuid, listaId: uuid, listaRevision: z.number().int().positive(),
        tipo, valorCentavos: z.number().int().safe().nonnegative(), despesaVisitaCriada: z.literal(false), faturavelCriado: z.literal(false) }).strict().parse(data);
      if (r.requestId !== p.requestId || r.clienteId !== p.clienteId || r.fonteId !== p.fonteId || r.listaId !== p.listaId ||
        r.listaRevision !== p.listaRevision || r.tipo !== p.tipo || r.valorCentavos !== p.valorCentavos) throw new Error("Recibo divergente");
      await conferirAtor(); await cache.invalidateQueries({ queryKey: raiz }); await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setDescricao(""); setValor(""); setCategoria(""); setConfirmacao(null);
      setAviso("Fonte declarada. Nenhuma despesa de Visita ou cobrança foi criada.");
    } catch { setAviso("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    const centavos = valorReaisParaCentavos(valor);
    if (trava.current || pendente || !permitirEdicao || confirmacao !== fotografia || centavos === null || centavos > 1_000_000_000_000) return;
    try {
      const p = pedidoSchema.parse({ atorId: usuario, clienteId: cliente, requestId: crypto.randomUUID(), fonteId: crypto.randomUUID(),
        listaId, listaRevision: listaRevisao, tipo: categoria, descricao, valorCentavos: centavos });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setAviso("Confira tipo, descrição, valor e sessão. Nada foi enviado."); }
  }
  const itens = consulta.data?.pages.flat() ?? [];
  return <section aria-label="Fontes declaradas de aquisição">
    <h4>Fontes declaradas de aquisição</h4>
    <p>Material e retirada exclusiva não são despesas de Visita. Confira duplicidades: registros diferentes podem representar o mesmo gasto. Estas fontes ainda não compõem automaticamente o orçamento.</p>
    {consulta.isFetching && <p role="status">Consultando fontes…</p>}
    {consulta.isError && <p role="alert">Fontes indisponíveis. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && (itens.length === 0 ? <p>Nenhuma fonte declarada.</p> :
      <ul>{itens.map((f) => <li key={f.id}>{f.tipo === "material" ? "Material" : "Retirada exclusiva"} · {f.descricao} · {f.valor_centavos} centavos · lista revisão {f.lista_revisao}</li>)}</ul>)}
    {!consulta.isError && consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais fontes</button>}
    {import.meta.env.VITE_SSO_RETIFICAR_FONTE_AQUISICAO_ENABLED === "true" && <RetificarFonteAquisicao usuario={usuario} cliente={cliente} listaId={listaId}
      listaRevisao={listaRevisao} fontes={!consulta.isFetching && !consulta.isError ? itens : []} disponivel={permitirEdicao && !!consulta.data && !consulta.isFetching && !consulta.isError} />}
    {pendente === "invalido" ? <p role="alert">Tentativa inválida. Procure suporte.</p> : pendente ? <>
      <p>Há uma tentativa pendente; o resultado pode ser incerto.</p><button type="button" disabled={ocupado || !permitirEdicao} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</button>
    </> : permitirEdicao && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
      <label>Tipo <select value={categoria} required onChange={(e) => { const valorTipo = e.target.value; setCategoria(valorTipo === "material" || valorTipo === "retirada_exclusiva" ? valorTipo : ""); setConfirmacao(null); }}>
        <option value="">Selecione</option><option value="material">Material</option><option value="retirada_exclusiva">Retirada exclusiva</option></select></label>
      <label>Descrição <textarea maxLength={1000} required value={descricao} onChange={(e) => { setDescricao(e.target.value); setConfirmacao(null); }} /></label>
      <label>Valor em reais <input type="text" inputMode="decimal" maxLength={24} required value={valor} onChange={(e) => { setValor(e.target.value); setConfirmacao(null); }} /></label>
      <p>Use vírgula para centavos, por exemplo 150,00.</p>
      {valor.trim() && valorCentavos === null && <p role="alert">Informe um valor válido em reais, com até duas casas decimais.</p>}
      <label><input type="checkbox" checked={confirmacao === fotografia} disabled={!categoria || !descricao.trim() || valorCentavos === null || ocupado}
        onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi a fonte e verifiquei possíveis duplicidades.</label>
      <button type="submit" disabled={ocupado || !categoria || !descricao.trim() || valorCentavos === null || confirmacao !== fotografia}>Declarar fonte</button>
    </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
