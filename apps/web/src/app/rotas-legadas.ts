// E01-S190 task 5 — mapa de rotas legadas.
//
// POR QUE ESTE ARQUIVO HOJE É QUASE VAZIO (e por que isso é a resposta certa, não um atalho)
// A navegação do PCM não tem URL por view (`pcmView` é `useState`, sem sincronização com
// `window.location` — confirmado por auditoria em 17/11/2026: nenhum `useSearchParams`/
// `?view=` no app, diferente de `GuiaView`, que lê `?guia=pcm` da URL). Isso significa que não
// existe hoje nenhum link externo, favorito ou bookmark apontando pra uma `view` antiga que esta
// reorganização pudesse quebrar — e a reorganização desta story **não removeu nenhuma view**, só
// reagrupou onde cada uma aparece no menu (ver `navegacao-sso.ts`). `assessment`, `pmoc`,
// `agenda-tecnico` e `ferramentas-por-tecnico` continuam sendo views válidas, renderizadas pelos
// mesmos componentes de sempre — só pararam de ser item principal da sidebar.
//
// Este arquivo existe mesmo assim, como o ÚNICO ponto autorizado a resolver um identificador de
// view legado para o atual — para o dia em que: (a) E00-S21 (rotas reais) sincronizar `pcmView`
// com a URL, ou (b) uma view for de fato removida (não só reagrupada) numa story futura. Nesse
// dia, a entrada entra aqui, com teste, em vez de a página simplesmente sumir.
export const ROTAS_LEGADAS: Readonly<Record<string, string>> = {};

/** Resolve um identificador de view — legado ou atual — para a view efetiva de hoje. Identidade
 * para qualquer coisa que não está no mapa (é o caso de 100% das views desta story). */
export function resolverRotaLegada(view: string): string {
  return ROTAS_LEGADAS[view] ?? view;
}
