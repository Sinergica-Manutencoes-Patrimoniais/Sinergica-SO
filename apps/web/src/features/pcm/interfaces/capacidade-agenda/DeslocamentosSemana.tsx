import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const inteiro = z.number().int().nonnegative().safe();
const linha = z.object({ visita_id: z.string().guid(), revisao_visita: inteiro.positive(), inicio_em: z.string().datetime({ offset: true }),
  fuso: z.string().min(1), revisao_declaracao: inteiro.positive().nullable(), revisao_visita_declarada: inteiro.positive().nullable(),
  minutos_por_pessoa: inteiro.max(10080).nullable(), pessoas_proprias: inteiro.max(1000).nullable(), minutos_homem: inteiro.nullable() }).strict();

/** Consulta parcial: fontes independentes não são fotografia nem demonstram esforço restante. */
export function DeslocamentosSemana({ userId, clienteId, semana, aoUsarParcial }: { userId: string; clienteId: string; semana: string; aoUsarParcial?: (dados: { semana: string; minutosHomem: number }) => void }) {
  const consulta = useInfiniteQuery({ queryKey: ["deslocamentos-semana", userId, clienteId, semana], gcTime: 0, retry: false,
    initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_deslocamentos_semana", { p_cliente_id: clienteId, p_semana_inicio: semana, p_apos: pageParam, p_limite: 50 }).abortSignal(signal);
      if (error) throw error;
      const linhas = z.array(linha).max(50).parse(data);
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const item of linhas) {
        const id = item.visita_id.toLowerCase();
        const campos = [item.revisao_declaracao, item.revisao_visita_declarada, item.minutos_por_pessoa, item.pessoas_proprias, item.minutos_homem];
        if (id <= anterior || (campos.some((v) => v === null) && campos.some((v) => v !== null)) ||
          (item.minutos_homem !== null && item.minutos_homem !== item.minutos_por_pessoa! * item.pessoas_proprias!)) throw new Error("Página divergente.");
        anterior = id;
      }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return linhas;
    }, getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.visita_id : undefined });
  const itens = !consulta.isFetching && !consulta.isError ? consulta.data?.pages.flat() ?? [] : [];
  // Uma atualização concorrente entre páginas não pode somar uma mesma Visita duas vezes.
  const paginasDivergentes = itens.some((item, indice) => indice > 0 &&
    item.visita_id.toLowerCase() <= itens[indice - 1]!.visita_id.toLowerCase());
  const atuais = itens.filter((i) => i.revisao_declaracao !== null && i.revisao_visita_declarada === i.revisao_visita);
  const pendentes = itens.filter((i) => i.revisao_declaracao === null).length;
  const desatualizados = itens.filter((i) => i.revisao_declaracao !== null && i.revisao_visita_declarada !== i.revisao_visita).length;
  const subtotal = atuais.reduce((total, i) => total + (i.minutos_homem ?? 0), 0);
  return <section aria-label="Deslocamentos declarados na semana"><h4>Deslocamentos declarados na semana</h4>
    <p>Subtotal das Visitas carregadas com declaração na revisão atual. Não é fotografia completa, não comprova execução e não está somado às estimativas de OS.</p>
    {consulta.isFetching && <output>Consultando deslocamentos…</output>}
    {consulta.isError && <p role="alert">Deslocamentos indisponíveis. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && paginasDivergentes && <p role="alert">As páginas de deslocamento mudaram durante a consulta. Atualize antes de usar os valores. <button type="button" onClick={() => void consulta.refetch()}>Atualizar</button></p>}
    {!consulta.isFetching && !consulta.isError && !paginasDivergentes && consulta.data && <>
      {Number.isSafeInteger(subtotal) ? <p>{subtotal} minutos-homem declarados · {pendentes} Visitas sem declaração · {desatualizados} declarações para revisão anterior.</p> : <p role="alert">Subtotal excede precisão permitida.</p>}
      {aoUsarParcial && atuais.length > 0 && Number.isSafeInteger(subtotal) && <button type="button" onClick={() => aoUsarParcial({ semana, minutosHomem: subtotal })}>Usar subtotal parcial nesta hipótese</button>}
      <p>{consulta.hasNextPage ? "Há mais páginas; subtotal incompleto." : "Não há outra página nesta consulta; alterações concorrentes e outras fontes podem não estar refletidas."}</p>
      <ul>{itens.map((i) => <li key={i.visita_id}>Visita {i.visita_id} · {i.inicio_em} ({i.fuso}) · {i.revisao_declaracao === null ? "sem declaração" : i.revisao_visita_declarada !== i.revisao_visita ? "declaração desatualizada; excluída do subtotal" : `${i.minutos_homem} minutos-homem declarados`}</li>)}</ul>
    </>}
    {!paginasDivergentes && consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais Visitas</button>}
  </section>;
}
