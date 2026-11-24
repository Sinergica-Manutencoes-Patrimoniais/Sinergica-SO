// E01-S190 task 5 — mapa de rotas antigas (AC-3 / SC-003: "toda rota antiga responde,
// redirecionada, nunca quebrada").
//
// POR QUE ISTO É UM ARQUIVO, E NÃO UM `if` SOLTO NA HOMEPAGE
// A consolidação do menu muda o lugar das telas: Assessment vira tipo de Inspeção, PMOC vira
// modalidade do Plano, Agenda do Técnico é absorvida por Planejamento e Visitas. Quem tinha
// favorito, link em e-mail ou deep-link gravado precisa cair no lugar novo — nunca numa tela
// vazia. Um mapa literal é o que permite TESTAR isso por tabela: o teste varre `VIEWS_LEGADAS`
// inteira e falha no dia em que alguém tirar uma view da árvore sem dizer para onde ela foi.
//
// ESTADO HONESTO DESTA FATIA: quase todo destino é a própria view. É o esperado — nesta fatia
// nenhuma tela saiu do ar; o que mudou foi agrupamento e rótulo. O valor do arquivo é ser a
// trava que impede a PRÓXIMA fatia (migrations de Assessment/PMOC, tasks 6–8) de matar uma rota
// em silêncio: quando `trabalho.assessment` sair de `NAVEGACAO_SSO`, este mapa tem que apontar
// `assessment` para `inspecoes` ou o teste quebra.
import type { PcmView } from "./navegacao-sso";
import { NAVEGACAO_SSO } from "./navegacao-sso";

/** Toda view de PCM que já teve entrada de menu própria em alguma versão publicada. */
export const VIEWS_LEGADAS: readonly PcmView[] = [
  "dashboard",
  "clientes",
  "cliente-grupos",
  "equipamentos",
  "equipes",
  "agenda-tecnico",
  "relatorio-planejamento",
  "relatorio-diario",
  "relatorio-cliente",
  "ferramentas",
  "ferramentas-por-tecnico",
  "funcionarios",
  "tipos-tarefa",
  "segmentos",
  "palavras-chave",
  "equipamento-categorias",
  "chamados",
  "ordens",
  "backlog",
  "inspecoes",
  "assessment",
  "cliente-marcacoes",
  "pmoc",
  "preventivas",
  "laudos-spda",
  "apontamento-horas",
  "tipos-inspecao",
  "sistemas",
];

/**
 * Rota antiga → rota que a atende hoje.
 *
 * Identidade NÃO é redundância: declarar explicitamente que `inspecoes` continua `inspecoes` é
 * o que permite distinguir "continua no lugar" de "alguém esqueceu de mapear".
 *
 * `chamados` e `backlog` continuam apontando para si mesmos de propósito: os três (`ordens`,
 * `chamados`, `backlog`) abrem o MESMO board desde E01-S118, e `backlog` carrega a aba inicial
 * do deep-link do Dashboard. Mapear para `ordens` perderia a aba. Eles aparecem em
 * `absorveu` da entrada "Chamados" da árvore nova — é lá que a relação está declarada.
 */
export const ROTAS_LEGADAS: Readonly<Record<PcmView, PcmView>> = {
  dashboard: "dashboard",
  clientes: "clientes",
  "cliente-grupos": "cliente-grupos",
  equipamentos: "equipamentos",
  equipes: "equipes",
  "agenda-tecnico": "agenda-tecnico",
  "relatorio-planejamento": "relatorio-planejamento",
  "relatorio-diario": "relatorio-diario",
  "relatorio-cliente": "relatorio-cliente",
  ferramentas: "ferramentas",
  "ferramentas-por-tecnico": "ferramentas-por-tecnico",
  funcionarios: "funcionarios",
  "tipos-tarefa": "tipos-tarefa",
  segmentos: "segmentos",
  "palavras-chave": "palavras-chave",
  "equipamento-categorias": "equipamento-categorias",
  chamados: "chamados",
  ordens: "ordens",
  backlog: "backlog",
  inspecoes: "inspecoes",
  // Tasks 6–8 (migrations de classificação) trocam este destino por "inspecoes".
  assessment: "assessment",
  "cliente-marcacoes": "cliente-marcacoes",
  // Tasks 6–8 trocam este destino pela visão filtrada do Plano de Manutenção.
  pmoc: "pmoc",
  preventivas: "preventivas",
  "laudos-spda": "laudos-spda",
  "apontamento-horas": "apontamento-horas",
  "tipos-inspecao": "tipos-inspecao",
  sistemas: "sistemas",
};

/** Views efetivamente alcançáveis pela árvore nova — as que são entrada de menu mais as que
 * alguma entrada declara ter absorvido. É o conjunto contra o qual o destino de uma rota
 * legada precisa fechar. */
export function viewsAlcancaveis(): ReadonlySet<PcmView> {
  const alcancaveis = new Set<PcmView>();
  for (const entrada of NAVEGACAO_SSO) {
    if (entrada.view) alcancaveis.add(entrada.view);
    for (const absorvida of entrada.absorveu ?? []) alcancaveis.add(absorvida);
  }
  return alcancaveis;
}

/** Destino de uma rota antiga, ou `null` quando o identificador não é uma view conhecida —
 * nunca um erro de tela, nunca um `undefined` que vira tela branca. */
export function resolverRotaLegada(view: string): PcmView | null {
  return Object.hasOwn(ROTAS_LEGADAS, view) ? ROTAS_LEGADAS[view as PcmView] : null;
}

/** Deep-link `?view=<id>` da URL, já resolvido pelo mapa. Usado só quando a navegação por
 * função está ligada — com a flag desligada a Home abre exatamente como abria antes. */
export function rotaInicialDaUrl(search: string): PcmView | null {
  const pedida = new URLSearchParams(search).get("view");
  return pedida ? resolverRotaLegada(pedida) : null;
}
