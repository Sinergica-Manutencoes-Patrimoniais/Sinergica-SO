import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const centavos = z.number().int().nonnegative().safe();
const pedidoSchema = z.object({ requestId: z.string().uuid(), propostaId: z.string().uuid(), expectedRevision: z.number().int().positive(),
  precoCentavos: centavos.max(1000000000000), motivo: z.string().trim().min(1).max(2000), protocolo: z.literal("mediado").optional() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { usuario: string; cliente: string; ordemServico: string; propostaId: string; versao: number };
export function ExcecaoPreco(props: Props) {
  if (import.meta.env.VITE_SSO_EXCECAO_PRECO_OPERACIONAL_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.propostaId])} {...props} />;
}
function Conteudo({ usuario, cliente, ordemServico, propostaId, versao }: Props) {
  const chave = `sso-excecao-preco:${usuario}:${cliente}:${propostaId}`; const queryClient = useQueryClient();
  const [preco, setPreco] = useState(""); const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo)); return p.propostaId === propostaId ? p : "invalido";
    } catch { return "invalido"; }
  });
  async function conferirSessao(signal?: AbortSignal) { const atual = await supabase.auth.getUser(); if (atual.error || atual.data.user?.id !== usuario || signal?.aborted) throw new Error("Sessão alterada."); }
  const condicoes = useQuery({ queryKey: ["excecao-preco", usuario, cliente, propostaId], gcTime: 0, retry: false,
    queryFn: async ({ signal }) => { await conferirSessao(signal); const { data, error } = await (import.meta.env.VITE_SSO_EXCECAO_PRECO_MEDIADA_ENABLED === "true" ? supabase.schema("comercial").rpc("sso_condicoes_excecao_preco_mediada", { p_ator_id: usuario, p_cliente_id: cliente, p_proposta_id: propostaId }) : supabase.schema("comercial").rpc("sso_condicoes_excecao_preco", { p_proposta_id: propostaId })).abortSignal(signal);
      if (error) throw error; const resultado = z.array(z.object({ versao: z.number().int().positive(), status: z.string(), preco_centavos: centavos,
        piso_centavos: centavos, sugerido_centavos: centavos }).strict()).length(1).parse(data)[0]; await conferirSessao(signal); return resultado; } });
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    await conferirSessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
    const { data, error } = await supabase.schema("comercial").rpc(p.protocolo === "mediado" ? "sso_excepcionar_preco_mediado" : "sso_excepcionar_preco_operacional", {
      ...(p.protocolo === "mediado" ? { p_ator_id: usuario, p_cliente_id: cliente } : {}),
      p_request_id: p.requestId, p_proposta_id: p.propostaId, p_expected_revision: p.expectedRevision,
      p_preco_centavos: p.precoCentavos, p_motivo: p.motivo });
    if (error) throw error;
    if (!data || data.aggregateId !== propostaId || data.requestId !== p.requestId || data.revision !== p.expectedRevision + 1 || data.state !== "rascunho") throw new Error("Resposta inválida.");
    await conferirSessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
  }, onSuccess: async (_resultado, p) => { try {
    await queryClient.invalidateQueries({ queryKey: ["orcamentos-operacionais", usuario, cliente, ordemServico] });
    await queryClient.invalidateQueries({ queryKey: ["excecao-preco", usuario, cliente, propostaId] });
    await conferirSessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada."); sessionStorage.removeItem(chave);
    setPendente(null); setConfirmacao(null); setMensagem("Exceção registrada em nova versão. Nenhuma proposta foi enviada.");
  } catch { setMensagem("Resultado confirmado, mas a tentativa local não pôde ser limpa. Consulte suporte."); } },
  onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."), });
  function registrar(p: Pedido) { try { const salvo = sessionStorage.getItem(chave); if (salvo !== null && salvo !== JSON.stringify(p)) throw new Error("Tentativa divergente."); if (salvo === null) sessionStorage.setItem(chave, JSON.stringify(p)); } catch { setMensagem("Não foi possível guardar tentativa; exceção não enviada."); return; }
    setPendente(p); setMensagem(""); enviar.mutate(p); }
  const atual = condicoes.data;
  const fotografia = JSON.stringify([usuario, cliente, propostaId, versao, atual ?? null, preco, motivo.trim()]);
  return <section aria-label="Exceção de preço"><h5>Exceção de preço</h5>
    <p>Exige administrador e concessão específica. A decisão gera nova versão, sem enviar proposta.</p>
    {condicoes.isFetching && <p>Verificando acesso e piso…</p>}
    {condicoes.isError && <p role="alert">Exceção indisponível ou sem permissão.</p>}
    {atual && !condicoes.isFetching && !condicoes.isError && <p>Preço atual {atual.preco_centavos} centavos · piso {atual.piso_centavos} · sugerido {atual.sugerido_centavos} · versão {atual.versao}.</p>}
    <form onSubmit={(e) => { e.preventDefault(); if (!atual || condicoes.isFetching || condicoes.isError || atual.status !== "rascunho" || atual.versao !== versao || pendente || enviar.isPending || confirmacao !== fotografia) return;
      try { const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), propostaId, expectedRevision: versao,
        precoCentavos: /^\d+$/.test(preco) ? Number(preco) : NaN, motivo, ...(import.meta.env.VITE_SSO_EXCECAO_PRECO_MEDIADA_ENABLED === "true" ? { protocolo: "mediado" as const } : {}) });
        if (p.precoCentavos >= atual.piso_centavos) throw new Error("Preço não exige exceção"); registrar(p);
      } catch { setMensagem("Informe preço inteiro abaixo do piso e motivo."); }
    }}><fieldset disabled={!!pendente || enviar.isPending || condicoes.isFetching || condicoes.isError || !atual || atual.status !== "rascunho" || atual.versao !== versao}>
      <label>Preço autorizado em centavos <input inputMode="numeric" value={preco} onChange={(e) => { setPreco(e.target.value); setConfirmacao(null); }} /></label>
      <label>Motivo <textarea maxLength={2000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      <label><input type="checkbox" checked={confirmacao === fotografia} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Autorizo o preço abaixo do piso nesta versão.</label>
      <button type="submit" disabled={confirmacao !== fotografia}>Registrar exceção</button>
    </fieldset></form>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
