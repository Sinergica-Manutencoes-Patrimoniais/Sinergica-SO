// E01-S190 — árvore de navegação do PCM extraída de `HomePage.tsx` e reorganizada em
// Trabalho/Gestão/Administração por decisão do Fabrício (respostas 26/27, 17/11/2026 — ver
// docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md seção 0).
//
// REGRA DESTA STORY (não repetir noutra): isto é reagrupamento de MENU, nunca reescrita de regra
// de negócio nem fusão de entidade. Toda `view` abaixo é a MESMA que já existia em `PCM_NAV` —
// nenhum `view` novo foi inventado, nenhuma página foi reescrita. O que muda é em qual grupo/nível
// cada entrada aparece, e quais ficam como `filhos` (submenu) em vez de item principal.
//
// Decisões de absorção, uma a uma (prova de AC-7 — nada sumiu sem decisão registrada):
//   - "Assessment" vira filho de "Inspeções", relabelado "Diagnóstico Inicial do Cliente"
//     (resposta 26). A página (`AssessmentPage`, `view: "assessment"`) continua a mesma — já
//     tinha as mesmas ações de derivar Chamado/Backlog/OS e importar questionário Auvo que
//     `InspecoesPage` tem; o que muda é só onde se chega nela.
//   - "PMOC" e "Preventivas" migram de OPERAÇÃO para o grupo "PLANOS" (resposta 26: PMOC é
//     modalidade do Plano de Manutenção). `PmocPage`/`view: "pmoc"` continua intacta.
//   - "Agenda do Técnico" migra de OPERAÇÃO para "PLANEJAMENTO E VISITAS" — view inalterada;
//     a substituição de verdade pela visão derivada de Visita é escopo de E01-S192, não desta story.
//   - "Componentes" e "Sistemas" viram filhos de "Clientes e Estrutura" (resposta 27: menu e
//     jornada se unificam, as entidades continuam separadas — nenhuma tabela foi tocada).
//   - "Ferramentas" (CADASTROS) e "Ferramentas por Técnico" (OPERAÇÃO) migram para "EQUIPES E
//     RECURSOS", junto de Equipes e Funcionários — grupo novo em Gestão, views inalteradas.
//   - "Relatório" (view `relatorio-planejamento`, estava em OPERAÇÃO) migra para o grupo
//     RELATÓRIOS existente, que sobe de Trabalho para Gestão.
//   - Todo o grupo CONFIGURAÇÕES (catálogos administrativos) migra para o nível `administracao`.
//
// "Central de Pendências" (citada no AC-4 da spec) **não** entra como item novo nesta story — não
// existe hoje uma tela própria para isso (pendências só são vistas de dentro da Visão 360 por
// cliente); criar uma teria sido inventar página, fora do escopo de reagrupamento. Fica registrado
// aqui como pendência explícita para quando E01-S197 (pendências agrupadas por ativo) existir.

export type Nivel = "trabalho" | "gestao" | "administracao";

export interface EntradaNav {
  /** Identificador estável da entrada — geralmente igual à `view`, exceto grupos sem view própria. */
  readonly id: string;
  readonly label: string;
  readonly nivel: Nivel;
  readonly grupo: string;
  /** `view` do PCM que esta entrada navega. Ausente só em entradas puramente decorativas/atalho. */
  readonly view?: string;
  /** Atalho pra fora do módulo PCM (ver `atalhoConfigGrupos` original) — nunca duplica o CRUD. */
  readonly atalhoConfigGrupos?: boolean;
  /** Submenu — não navega por si; cada filho tem sua própria `view`. */
  readonly filhos?: readonly EntradaNav[];
  /** Quando presente, só aparece a quem tem a capacidade — hoje `undefined` em todas as entradas
   * que não são administrativas (capacidade granular ainda não existe — E00-S26). As
   * administrativas usam `nivel: "administracao"`, que `navegacaoVisivel` trata por papel
   * (mesmo critério já usado em `podeGerenciarConfig`), não por capacidade nomeada ainda. */
  readonly capacidade?: string;
}

export const NAVEGACAO_SSO: readonly EntradaNav[] = [
  // ── TRABALHO ─────────────────────────────────────────────────────────────
  { id: "dashboard", label: "Dashboard", nivel: "trabalho", grupo: "OPERAÇÃO", view: "dashboard" },
  { id: "ordens", label: "Chamados", nivel: "trabalho", grupo: "OPERAÇÃO", view: "ordens" },
  {
    id: "inspecoes",
    label: "Inspeções",
    nivel: "trabalho",
    grupo: "OPERAÇÃO",
    view: "inspecoes",
    filhos: [
      {
        id: "assessment",
        label: "Diagnóstico Inicial do Cliente",
        nivel: "trabalho",
        grupo: "OPERAÇÃO",
        view: "assessment",
      },
    ],
  },
  {
    id: "clientes",
    label: "Clientes e Estrutura",
    nivel: "trabalho",
    grupo: "OPERAÇÃO",
    view: "clientes",
    filhos: [
      {
        id: "equipamentos",
        label: "Componentes",
        nivel: "trabalho",
        grupo: "OPERAÇÃO",
        view: "equipamentos",
      },
      { id: "sistemas", label: "Sistemas", nivel: "trabalho", grupo: "OPERAÇÃO", view: "sistemas" },
    ],
  },
  {
    id: "pmoc",
    label: "PMOC",
    nivel: "trabalho",
    grupo: "PLANOS",
    view: "pmoc",
  },
  {
    id: "preventivas",
    label: "Preventivas",
    nivel: "trabalho",
    grupo: "PLANOS",
    view: "preventivas",
  },
  {
    id: "agenda-tecnico",
    label: "Agenda do Técnico",
    nivel: "trabalho",
    grupo: "PLANEJAMENTO E VISITAS",
    view: "agenda-tecnico",
  },

  // ── GESTÃO ───────────────────────────────────────────────────────────────
  {
    id: "equipes",
    label: "Equipes",
    nivel: "gestao",
    grupo: "EQUIPES E RECURSOS",
    view: "equipes",
  },
  {
    id: "funcionarios",
    label: "Funcionários",
    nivel: "gestao",
    grupo: "EQUIPES E RECURSOS",
    view: "funcionarios",
  },
  {
    id: "ferramentas",
    label: "Ferramentas",
    nivel: "gestao",
    grupo: "EQUIPES E RECURSOS",
    view: "ferramentas",
  },
  {
    id: "ferramentas-por-tecnico",
    label: "Ferramentas por Técnico",
    nivel: "gestao",
    grupo: "EQUIPES E RECURSOS",
    view: "ferramentas-por-tecnico",
  },
  {
    id: "relatorio-diario",
    label: "Relatório do Dia",
    nivel: "gestao",
    grupo: "RELATÓRIOS",
    view: "relatorio-diario",
  },
  {
    id: "relatorio-cliente",
    label: "Relatório do Cliente",
    nivel: "gestao",
    grupo: "RELATÓRIOS",
    view: "relatorio-cliente",
  },
  {
    id: "laudos-spda",
    label: "Laudo SPDA",
    nivel: "gestao",
    grupo: "RELATÓRIOS",
    view: "laudos-spda",
  },
  {
    id: "apontamento-horas",
    label: "Apontamento de Horas",
    nivel: "gestao",
    grupo: "RELATÓRIOS",
    view: "apontamento-horas",
  },
  {
    id: "relatorio-planejamento",
    label: "Relatório",
    nivel: "gestao",
    grupo: "RELATÓRIOS",
    view: "relatorio-planejamento",
  },

  // ── ADMINISTRAÇÃO (guardada por papel — mesmo critério de podeGerenciarConfig) ──────────────
  {
    id: "tipos-tarefa",
    label: "Tipos de Tarefa",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    view: "tipos-tarefa",
  },
  {
    id: "cliente-grupos",
    label: "Grupos de Clientes",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    view: "cliente-grupos",
  },
  {
    id: "cliente-marcacoes",
    label: "Marcações de Cliente",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    view: "cliente-marcacoes",
  },
  {
    id: "tipos-inspecao",
    label: "Tipos de Inspeção",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    view: "tipos-inspecao",
  },
  {
    id: "equipamento-categorias",
    label: "Categorias Equip.",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    view: "equipamento-categorias",
  },
  {
    id: "segmentos",
    label: "Segmentos",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    view: "segmentos",
  },
  {
    id: "palavras-chave",
    label: "Palavras-chave",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    view: "palavras-chave",
  },
  {
    id: "grupos-usuario",
    label: "Grupos de Usuário",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    atalhoConfigGrupos: true,
  },
] as const;

export function entradasPorNivel(nivel: Nivel): readonly EntradaNav[] {
  return NAVEGACAO_SSO.filter((entrada) => entrada.nivel === nivel);
}

export function entradasPorGrupo(nivel: Nivel): ReadonlyMap<string, readonly EntradaNav[]> {
  return agruparPorGrupo(entradasPorNivel(nivel));
}

/** Agrupa QUALQUER lista de entradas por `grupo`, preservando a ordem de declaração dentro de
 * cada grupo — usada no render (sobre o resultado já filtrado de `navegacaoVisivel`) e por
 * `entradasPorGrupo` (sobre o nível inteiro, sem filtro de visibilidade). */
export function agruparPorGrupo(
  entradas: readonly EntradaNav[],
): ReadonlyMap<string, readonly EntradaNav[]> {
  const porGrupo = new Map<string, EntradaNav[]>();
  for (const entrada of entradas) {
    const lista = porGrupo.get(entrada.grupo) ?? [];
    lista.push(entrada);
    porGrupo.set(entrada.grupo, lista);
  }
  return porGrupo;
}

/** Todas as `view`s alcançáveis (pai + filhos) — usado pelo inventário (task 1/15) e por
 * `rotas-legadas.ts` pra garantir que nenhum alvo de redirecionamento seja inválido. */
export function todasAsViews(): readonly string[] {
  const views: string[] = [];
  for (const entrada of NAVEGACAO_SSO) {
    if (entrada.view) views.push(entrada.view);
    for (const filho of entrada.filhos ?? []) if (filho.view) views.push(filho.view);
  }
  return views;
}

/** AC-6 — ocultar é CONSEQUÊNCIA da permissão, nunca lista fixa por papel. Pura: recebe o
 * resultado da checagem de permissão em vez de consultá-la, pra ser testável sem rede/sessão.
 *
 * Hoje a única "capacidade" real disponível é o papel administrativo (superadmin/supervisor) —
 * mesmo critério já usado em `podeGerenciarConfig` (HomePage.tsx). Quando E00-S26 (capacidades
 * sensíveis) existir, `temCapacidadeAdministrativa` passa a consultar o conjunto de capacidades
 * reais em vez de reimplementar o papel aqui — a assinatura já está pronta pra isso. */
export function navegacaoVisivel(
  entradas: readonly EntradaNav[],
  temCapacidadeAdministrativa: boolean,
): readonly EntradaNav[] {
  return entradas.filter(
    (entrada) => entrada.nivel !== "administracao" || temCapacidadeAdministrativa,
  );
}
