import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const inteiro = z.union([z.number(), z.string().regex(/^\d+$/)]).refine((v) => Number.isSafeInteger(Number(v)) && Number(v) >= 0);
const diagnosticoSchema = z.object({
  revision: inteiro.refine((v) => Number(v) > 0),
  encerrado: z.boolean(), composicaoCompleta: z.boolean(),
  parcelas: inteiro, parcelasPendentesOuInconsistentes: inteiro,
  continuacoesPendentes: inteiro, continuacoesInconsistentes: inteiro,
  continuacoesDevolvidas: inteiro.optional(),
  ordensCliente: inteiro, ordensNaoFinalizadas: inteiro, ordensClienteDivergente: inteiro,
  aptoIndicativo: z.boolean(), revalidacaoTransacionalObrigatoria: z.literal(true),
}).refine((d) => !d.aptoIndicativo || (
  !d.encerrado && d.composicaoCompleta && Number(d.parcelas) > 0 &&
  Number(d.parcelasPendentesOuInconsistentes) === 0 && Number(d.continuacoesPendentes) === 0 &&
  Number(d.continuacoesInconsistentes) === 0 && Number(d.continuacoesDevolvidas ?? 0) === 0 && Number(d.ordensCliente) > 0 &&
  Number(d.ordensNaoFinalizadas) === 0 && Number(d.ordensClienteDivergente) === 0
));

export function AptidaoChamado({ usuario, cliente, chamado }: { usuario: string; cliente: string; chamado: string }) {
  const [tipo, setTipo] = useState<"parcela" | "continuacao" | "os">("parcela");
  const diagnosticoDevolvida = import.meta.env.VITE_SSO_DIAGNOSTICO_CONTINUACAO_DEVOLVIDA_ENABLED === "true";
  const resumo = useQuery({ queryKey: ["aptidao-chamado", usuario, cliente, chamado, diagnosticoDevolvida], gcTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      const requisicao = diagnosticoDevolvida
        ? supabase.schema("pcm").rpc("sso_diagnosticar_aptidao_continuacao_devolvida", { p_ator_id: usuario, p_cliente_id: cliente, p_chamado_id: chamado })
        : supabase.schema("pcm").rpc("sso_diagnosticar_aptidao_chamado", { p_cliente_id: cliente, p_chamado_id: chamado });
      const { data, error } = await requisicao.abortSignal(signal); if (error) throw error;
      const resultado = diagnosticoSchema.parse(data);
      if (diagnosticoDevolvida && resultado.continuacoesDevolvidas === undefined) throw new Error("Diagnóstico incompleto.");
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      return resultado;
    } });
  const itens = useInfiniteQuery({ queryKey: ["aptidao-chamado-itens", usuario, cliente, chamado, tipo], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_listar_itens_aptidao_chamado", { p_cliente_id: cliente, p_chamado_id: chamado, p_tipo: tipo, p_apos: pageParam, p_limite: 20 }).abortSignal(signal); if (error) throw error; if (!Array.isArray(data)) throw new Error("Itens inválidos."); return data as { id: string; descricao: string | null; situacao: string; referencia_os: string | null; diagnostico: string }[]; }, getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.id : undefined });
  const acessoConfirmado = !resumo.isFetching && !resumo.isError && !itens.isFetching && !itens.isError;
  return <section aria-label="Diagnóstico de aptidão do Chamado"><h5>Diagnóstico indicativo</h5><p>Fotografia de consulta, não é autorização de encerramento; o servidor deve revalidar todos os dados. OS de outro Cliente são apenas contadas como divergência.</p>
    {import.meta.env.VITE_SSO_CONTINUACAO_DEVOLVIDA_ENABLED === "true" && <p>Continuidade devolvida ao Backlog exige reconciliação. O diagnóstico anterior pode não reconhecer esse estado; encerramento e cancelamento permanecem bloqueados até a validação correspondente.</p>}
    {resumo.isError && <p role="alert">Diagnóstico indisponível. <button type="button" onClick={() => void resumo.refetch()}>Tentar novamente</button></p>}
    {acessoConfirmado && resumo.data && <p>Revisão {resumo.data.revision} · {import.meta.env.VITE_SSO_CONTINUACAO_DEVOLVIDA_ENABLED === "true" && !diagnosticoDevolvida ? "aptidão indeterminada: diagnóstico de continuidade indisponível" : resumo.data.aptoIndicativo ? "apto indicativo" : "pendências ou dados ausentes"} · composição {resumo.data.composicaoCompleta ? "completa" : "não declarada"} · parcelas {String(resumo.data.parcelas)}, pendentes/inconsistentes {String(resumo.data.parcelasPendentesOuInconsistentes)} · continuações pendentes {String(resumo.data.continuacoesPendentes)}, inconsistentes {String(resumo.data.continuacoesInconsistentes)} · OS do Cliente {String(resumo.data.ordensCliente)}, não finalizadas {String(resumo.data.ordensNaoFinalizadas)}, Cliente divergente {String(resumo.data.ordensClienteDivergente)}.</p>}
    {acessoConfirmado && resumo.data?.continuacoesDevolvidas !== undefined && <p>Continuações devolvidas que exigem reconciliação: {String(resumo.data.continuacoesDevolvidas)}.</p>}
    <label>Itens <select value={tipo} disabled={!acessoConfirmado} onChange={(e) => setTipo(e.target.value as "parcela" | "continuacao" | "os")}><option value="parcela">Parcelas</option><option value="continuacao">Continuações</option><option value="os">OS do Cliente</option></select></label>
    {itens.isError && <p role="alert">Itens indisponíveis. <button type="button" onClick={() => void itens.refetch()}>Tentar novamente</button></p>}
    {acessoConfirmado && itens.data && <ul>{itens.data.pages.flat().map((i) => <li key={i.id}>{i.descricao ?? i.id} · {i.situacao === "devolvida_backlog" ? "devolvida ao Backlog; requer reconciliação" : i.situacao} · {i.situacao === "devolvida_backlog" ? "não representa execução concluída" : i.diagnostico} {i.referencia_os && `· OS ${i.referencia_os}`}</li>)}</ul>}{acessoConfirmado && itens.hasNextPage && <button type="button" onClick={() => void itens.fetchNextPage()}>Mais itens</button>}
  </section>;
}
