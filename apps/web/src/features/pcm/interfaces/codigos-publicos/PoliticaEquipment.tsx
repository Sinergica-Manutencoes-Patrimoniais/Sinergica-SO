import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { useAuth } from "../../../../app/auth-context";
import { supabase } from "../../../../lib/supabase-client";

const linhaSchema = z.object({ categoria_id: z.string().uuid(), nome: z.string().min(1), controlado: z.boolean().nullable(), revisao: z.number().int().nonnegative() }).strict();
const pedidoSchema = z.object({ requestId: z.string().uuid(), categoriaId: z.string().uuid(), revision: z.number().int().nonnegative(), controlado: z.boolean(), motivo: z.string().min(1).max(2000) }).strict();
const reciboSchema = pedidoSchema.omit({ motivo: true }).extend({ revision: z.number().int().positive() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Linha = z.infer<typeof linhaSchema>;

export function PoliticaEquipment({ userId }: { userId: string }) {
  const { user } = useAuth();
  if (import.meta.env.VITE_SSO_POLITICA_EQUIPMENT_ENABLED !== "true" || user?.id !== userId || user.papel !== "superadmin") return null;
  return <Conteudo key={userId} userId={userId} />;
}

function Conteudo({ userId }: { userId: string }) {
  const chave = `sso-politica-equipment:${userId}`;
  const [selecionada, setSelecionada] = useState<Linha | null>(null);
  const [controlado, setControlado] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const valor = sessionStorage.getItem(chave); return valor ? pedidoSchema.parse(JSON.parse(valor)) : null; }
    catch { return "invalido"; }
  });
  const trava = useRef(false);
  const client = useQueryClient();
  const queryKey = ["politica-equipment", userId];
  const consulta = useInfiniteQuery({
    queryKey, gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_politica_equipment", { p_ator_id: userId, p_apos: pageParam, p_limite: 30 }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linhaSchema).max(30).parse(data);
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const linha of pagina) { const id = linha.categoria_id.toLowerCase(); if (anterior !== null && id <= anterior) throw new Error("Página inconsistente."); anterior = id; }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 30 ? pagina[pagina.length - 1]?.categoria_id : undefined,
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_configurar_politica_equipment", {
        p_ator_id: userId, p_request_id: p.requestId, p_categoria_id: p.categoriaId,
        p_revisao: p.revision, p_controlado: p.controlado, p_motivo: p.motivo,
      });
      if (error) throw error;
      const r = reciboSchema.parse(data);
      if (r.requestId !== p.requestId || r.categoriaId !== p.categoriaId || r.revision !== p.revision + 1 || r.controlado !== p.controlado) throw new Error("Resposta divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
    },
    onSuccess: async (_r, p) => {
      await client.invalidateQueries({ queryKey });
      try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente."); sessionStorage.removeItem(chave); }
      catch { setAviso("Alteração confirmada, mas tentativa local não foi removida. Consulte suporte."); return; }
      setPendente(null); setSelecionada(null); setMotivo(""); setAviso("Política registrada. A fila Auvo não foi alterada.");
    },
    onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."),
    onSettled: () => { trava.current = false; },
  });
  function enviar(p: Pedido) {
    if (trava.current || consulta.isError || consulta.isFetching) return;
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente."); }
    catch { setAviso("Tentativa local indisponível. Consulte suporte."); return; }
    trava.current = true; setAviso(""); envio.mutate(p);
  }
  function iniciar() {
    if (!selecionada || pendente || trava.current || consulta.isFetching || consulta.isError) return;
    const atual = consulta.data?.pages.flat().find((linha) => linha.categoria_id === selecionada.categoria_id);
    if (!atual || atual.revisao !== selecionada.revisao || atual.controlado !== selecionada.controlado) { setAviso("Política mudou; selecione novamente após atualizar."); return; }
    try {
      const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), categoriaId: selecionada.categoria_id, revision: selecionada.revisao, controlado, motivo: motivo.trim() });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
    } catch { setAviso("Confira motivo e sessão. Nada foi enviado."); }
  }
  return <section aria-label="Política de Equipment por categoria">
    <h2>Política global de Equipment por categoria</h2>
    <p>A configuração vale para todas as contas. Não altera a fila atual nem remove vínculos Auvo; a integração ainda está pendente.</p>
    {consulta.isFetching && <output>Consultando categorias…</output>}
    {consulta.isError && <p role="alert">Categorias indisponíveis. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <>
      <ul>{consulta.data.pages.flat().map((linha) => <li key={linha.categoria_id}>{linha.nome}: {linha.controlado === null ? "não configurada" : linha.controlado ? "controlado" : "somente SSO"} <button type="button" disabled={!!pendente || envio.isPending} onClick={() => { setSelecionada(linha); setControlado(linha.controlado ?? false); setMotivo(""); }}>Configurar</button></li>)}</ul>
      {consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais categorias</button>}
      {selecionada && !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}><p>Categoria: {selecionada.nome}, revisão {selecionada.revisao}.</p><label><input type="checkbox" checked={controlado} onChange={(e) => setControlado(e.target.checked)} /> Equipamento controlado</label><label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label><button type="submit" disabled={envio.isPending}>Registrar política</button></form>}
    </>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" && <p>Tentativa pendente para categoria {pendente.categoriaId}. <button type="button" disabled={envio.isPending || consulta.isFetching || consulta.isError} onClick={() => enviar(pendente)}>Repetir tentativa</button></p>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
