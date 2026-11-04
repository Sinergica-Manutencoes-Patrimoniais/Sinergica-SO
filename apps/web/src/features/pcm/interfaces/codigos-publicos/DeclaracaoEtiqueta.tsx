import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";

const pedidoSchema = z.object({
  requestId: z.string().uuid(), tipo: z.enum(["sistema", "componente", "grupo_quantitativo"]),
  ativoId: z.string().uuid(), codigo: z.string().min(1).max(200),
}).strict();
const respostaSchema = pedidoSchema.extend({ etiquetadoEm: z.string().datetime({ offset: true }), revision: z.number().int().positive() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; tipo: "sistema" | "componente" | "grupo_quantitativo"; ativoId: string };

export function DeclaracaoEtiqueta(props: Props) {
  if (props.tipo === "grupo_quantitativo" ? import.meta.env.VITE_SSO_DECLARAR_ETIQUETA_GRUPO_ENABLED !== "true" : import.meta.env.VITE_SSO_DECLARAR_ETIQUETA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.tipo, props.ativoId])} {...props} />;
}

function Conteudo({ userId, clienteId, tipo, ativoId }: Props) {
  const chave = `sso-etiqueta:${JSON.stringify([userId, clienteId, tipo, ativoId])}`;
  const [codigo, setCodigo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const valor = sessionStorage.getItem(chave);
      if (!valor) return null;
      const pedido = pedidoSchema.parse(JSON.parse(valor));
      return pedido.tipo === tipo && pedido.ativoId === ativoId ? pedido : "invalido";
    } catch { return "invalido"; }
  });
  const trava = useRef(false);
  const client = useQueryClient();
  const permissao = useQuery({
    queryKey: ["codigos-publicos", userId, clienteId, "etiqueta-permissao"],
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const autorizada = await supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.gerir", clienteId);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return autorizada;
    },
    gcTime: 0, refetchOnWindowFocus: true,
  });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const envio = useMutation({
    mutationFn: async (pedido: Pedido) => {
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Tentativa divergente.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc(tipo === "grupo_quantitativo" ? "sso_declarar_etiqueta_grupo" : "sso_declarar_etiquetagem", {
        p_ator_id: userId, p_cliente_id: clienteId, p_request_id: pedido.requestId,
        p_tipo: pedido.tipo, p_ativo_id: pedido.ativoId, p_codigo: pedido.codigo,
      });
      if (error) throw error;
      const resposta = respostaSchema.parse(data);
      if (resposta.requestId !== pedido.requestId || resposta.tipo !== pedido.tipo || resposta.ativoId !== pedido.ativoId || resposta.codigo !== pedido.codigo)
        throw new Error("Resposta divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
    },
    onSuccess: async (_resultado, pedido) => {
      try {
        await client.invalidateQueries({ queryKey: ["codigos-publicos", userId, clienteId] });
        const atual = await supabase.auth.getUser();
        if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
        if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Tentativa divergente.");
        sessionStorage.removeItem(chave);
      } catch { setAviso("Declaração confirmada, mas tentativa local não foi removida. Consulte suporte."); return; }
      setPendente(null); setCodigo(""); setConfirmado(false);
      setAviso(tipo === "grupo_quantitativo" ? "Declaração de etiqueta registrada." : "Declaração registrada. O código passa a ter marco de etiquetagem.");
    },
    onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."),
    onSettled: () => { trava.current = false; },
  });
  function enviar(pedido: Pedido) {
    if (!permitido || trava.current) return;
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Tentativa divergente."); }
    catch { setAviso("Tentativa local indisponível. Consulte suporte."); return; }
    trava.current = true; setAviso(""); envio.mutate(pedido);
  }
  function iniciar() {
    if (!permitido || !confirmado || pendente || trava.current || !codigo.trim()) return;
    try {
      const pedido = pedidoSchema.parse({ requestId: crypto.randomUUID(), tipo, ativoId, codigo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chave, JSON.stringify(pedido)); setPendente(pedido); enviar(pedido);
    } catch { setAviso("Não foi possível guardar a tentativa. Nada foi enviado."); }
  }
  if (permissao.isPending || permissao.isFetching) return <output>Verificando permissão de etiquetagem…</output>;
  if (permissao.isError) return <p role="alert">Permissão indisponível. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>;
  if (!permitido) return null;
  return <section aria-label="Declaração de etiquetagem">
    <h3>Registrar etiqueta aplicada</h3>
    <p>Informe exatamente o código que consta na etiqueta já aplicada. A declaração não cria nem imprime etiqueta.</p>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <p>Tentativa pendente para {pendente.codigo}. <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa</button></p> :
      !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <label>Código da etiqueta <input required maxLength={200} value={codigo} onChange={(e) => { setCodigo(e.target.value); setConfirmado(false); }} /></label>
        <label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} /> Confirmo que esta etiqueta já foi aplicada neste cadastro.</label>
        <button type="submit" disabled={!confirmado || envio.isPending}>Registrar declaração</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
