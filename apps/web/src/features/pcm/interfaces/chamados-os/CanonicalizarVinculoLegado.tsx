import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedidoSchema = z.object({
  requestId: z.string().guid(), clienteId: z.string().guid(), chamadoId: z.string().guid(),
  osId: z.string().guid(), revisao: z.number().int().positive().safe(), motivo: z.string().min(1).max(2000),
}).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const chamadoSchema = z.object({ id: z.string().guid(), cliente_id: z.string().guid(), numero: z.string(),
  ordem_servico_id: z.string().guid().nullable(), sso_revisao: z.number().int().positive().safe() });
const osSchema = z.object({ id: z.string().guid(), client_id: z.string().guid(), chamado_id: z.string().guid().nullable(), numero: z.string(), titulo: z.string() });
const respostaSchema = z.object({ requestId: z.string().guid(), clienteId: z.string().guid(),
  chamadoId: z.string().guid(), osId: z.string().guid(), numeroOs: z.string() });

export function CanonicalizarVinculoLegado(props: { usuario: string; cliente: string; chamado: string }) {
  if (import.meta.env.VITE_SSO_CANONICALIZAR_CHAMADO_ENABLED !== "true") return null;
  return <Formulario key={JSON.stringify([props.usuario, props.cliente, props.chamado])} {...props} />;
}

function Formulario({ usuario, cliente, chamado }: { usuario: string; cliente: string; chamado: string }) {
  const chave = `sso-canonicalizar-chamado:${JSON.stringify([usuario, cliente, chamado])}`;
  const client = useQueryClient();
  const trava = useRef(false);
  const [motivo, setMotivo] = useState("");
  const [fotoConfirmada, setFotoConfirmada] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const valor = sessionStorage.getItem(chave);
      if (!valor) return null;
      const pedido = pedidoSchema.parse(JSON.parse(valor));
      return pedido.clienteId === cliente && pedido.chamadoId === chamado ? pedido : "invalido";
    } catch { return "invalido"; }
  });
  async function conferirSessao() {
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== usuario) throw new Error("Sessão alterada.");
  }
  const consulta = useQuery({
    queryKey: ["s167-vinculo-legado", usuario, cliente, chamado], gcTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      await conferirSessao();
      const c = await supabase.schema("pcm").from("chamados").select("id,cliente_id,numero,ordem_servico_id,sso_revisao")
        .eq("id", chamado).eq("cliente_id", cliente).is("deleted_at", null).abortSignal(signal).maybeSingle();
      if (c.error) throw c.error;
      const ch = chamadoSchema.parse(c.data);
      if (ch.id !== chamado || ch.cliente_id !== cliente) throw new Error("Contexto divergente.");
      if (!ch.ordem_servico_id) { await conferirSessao(); if (signal.aborted) throw new Error("Consulta cancelada."); return { ch, os: null }; }
      const o = await supabase.schema("pcm").from("ordens_servico").select("id,client_id,chamado_id,numero,titulo")
        .eq("id", ch.ordem_servico_id).eq("client_id", cliente).is("deleted_at", null).abortSignal(signal).maybeSingle();
      if (o.error) throw o.error;
      const os = osSchema.parse(o.data);
      if (os.id !== ch.ordem_servico_id || os.client_id !== cliente) throw new Error("Contexto divergente.");
      await conferirSessao();
      if (signal.aborted) throw new Error("Consulta cancelada.");
      return { ch, os };
    },
  });
  const foto = JSON.stringify([consulta.data, motivo.trim()]);
  const disponivel = !consulta.isFetching && !consulta.isError && consulta.data?.os?.chamado_id === null;
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    await conferirSessao();
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_canonicalizar_vinculo_chamado", {
      p_request_id: p.requestId, p_cliente_id: p.clienteId, p_chamado_id: p.chamadoId,
      p_os_id: p.osId, p_expected_revision: p.revisao, p_motivo: p.motivo,
    });
    if (error) throw error;
    const resposta = respostaSchema.parse(data);
    if (resposta.requestId !== p.requestId || resposta.clienteId !== p.clienteId || resposta.chamadoId !== p.chamadoId || resposta.osId !== p.osId)
      throw new Error("Resposta divergente.");
    await conferirSessao();
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
    return resposta;
  }});
  async function enviar(p: Pedido) {
    if (trava.current) return;
    trava.current = true;
    setAviso("");
    try {
      await envio.mutateAsync(p);
      await client.invalidateQueries({ queryKey: ["s167-vinculo-legado", usuario, cliente, chamado], refetchType: "none" });
      await client.invalidateQueries({ queryKey: ["s167-resumo-chamados", usuario], refetchType: "none" });
      await client.invalidateQueries({ queryKey: ["chamado-painel", usuario, chamado], refetchType: "none" });
      await client.invalidateQueries({ queryKey: ["migracao-preflight-referencias", usuario, cliente], refetchType: "none" });
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave);
      setPendente(null); setMotivo(""); setFotoConfirmada(null);
      setAviso("Vínculo atualizado. Recarregue os dados para conferir.");
      void consulta.refetch();
    } catch { setAviso("Resultado não confirmado. Repita a mesma tentativa ou procure suporte; não inicie outra."); }
    finally { trava.current = false; }
  }
  function iniciar() {
    if (!disponivel || !consulta.data?.os || fotoConfirmada !== foto || pendente || trava.current) return;
    try {
      const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), clienteId: cliente, chamadoId: chamado,
        osId: consulta.data.os.id, revisao: consulta.data.ch.sso_revisao, motivo: motivo.trim() });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chave, JSON.stringify(p));
      setPendente(p);
      void enviar(p);
    } catch { setAviso("Não foi possível guardar a tentativa; nada foi enviado."); }
  }
  return <section aria-label="Vínculo legado de OS">
    <h3>Regularizar vínculo legado</h3>
    <p>Esta ação preserva número e histórico. Divergências precisam de análise pelo suporte.</p>
    {consulta.isFetching && <output>Consultando vínculo…</output>}
    {consulta.isError && <p role="alert">Não foi possível consultar o vínculo. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && !consulta.data.os && <p>Este Chamado não possui referência legada de OS.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.os && <>
      <p>Chamado {consulta.data.ch.numero} · OS {consulta.data.os.numero} — {consulta.data.os.titulo}
        {consulta.data.os.chamado_id === null ? " · sem vínculo canônico" : consulta.data.os.chamado_id.toLowerCase() === chamado.toLowerCase() ? " · já vinculada a este Chamado" : " · vinculada a outro Chamado"}</p>
      {consulta.data.os.chamado_id !== null && consulta.data.os.chamado_id.toLowerCase() !== chamado.toLowerCase() && <p role="alert">Vínculo divergente. Nenhuma alteração automática será feita; encaminhe para análise.</p>}
    </>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Procure suporte antes de continuar.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={envio.isPending} onClick={() => void enviar(pendente)}>Repetir mesma tentativa</button> : !pendente && disponivel && <>
      <label>Motivo <textarea maxLength={2000} value={motivo} onChange={e => { setMotivo(e.target.value); setFotoConfirmada(null); }} /></label>
      <label><input type="checkbox" checked={fotoConfirmada === foto} onChange={e => setFotoConfirmada(e.target.checked ? foto : null)} /> Conferi o Chamado, a OS e o motivo.</label>
      <button type="button" disabled={!motivo.trim() || fotoConfirmada !== foto || envio.isPending} onClick={iniciar}>Regularizar vínculo</button>
    </>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
