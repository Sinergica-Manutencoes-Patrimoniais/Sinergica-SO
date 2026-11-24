// E01-S190 — árvore de navegação do SSO, extraída de `HomePage.tsx` (tasks 2/3/4).
//
// POR QUE ESTE ARQUIVO EXISTE
// A navegação inteira morava dentro de `HomePage.tsx` (1339 linhas), misturada com estado de
// UI, deep-links e render. Reorganizar menu ali dentro produziria um diff ilegível e
// impossível de provar. Aqui o dado é literal e puro — dá pra testar e pra inventariar por
// fora (`scripts/inventariar-navegacao.mjs`).
//
// DUAS ÁRVORES CONVIVEM, DE PROPÓSITO
// 1. A VIGENTE (`PCM_NAV`, `CONFIG_NAV`, `ATENDIMENTO_NAV`, `FINANCEIRO_NAV`, `COMERCIAL_NAV`,
//    `GUIA_NAV`) — movida de `HomePage.tsx` SEM trocar um rótulo sequer. É a linha de base: com
//    a flag `VITE_SSO_NAVEGACAO_POR_FUNCAO_ENABLED` desligada, o menu é exatamente o de antes.
// 2. A NOVA (`NAVEGACAO_SSO`) — Trabalho · Gestão · Administração, conforme BL 013 do Pacote
//    Consolidado e a tabela do `plan.md`. Nasce desligada (E00-S28: toda jornada nova é opt-in).
// A árvore vigente só sai daqui quando a nova estiver homologada; apagar antes disso é como
// perder a testemunha.
//
// RESTRIÇÃO DURA (resposta 27 do Fabrício, 17/11): a unificação "Clientes e Estrutura" é de
// MENU e JORNADA, não de modelo. Cliente, Local, Sistema, Equipamento, Componente e Grupo
// quantitativo continuam entidades separadas, com regras e vínculos próprios. Nada neste
// arquivo funde entidade — ele só agrupa entradas de menu.
import {
  BarChart3,
  BellRing,
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Columns3,
  DollarSign,
  FileBarChart,
  FileSignature,
  FileText,
  Gauge,
  HardHat,
  Headset,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  LockKeyhole,
  MapPin,
  Megaphone,
  MessageCircle,
  Package,
  PieChart,
  Settings,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Tag,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  UserCircle,
  UserCog,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FinanceiroView } from "../features/financeiro/mock/FinanceiroMockRouter";
import type { GuiaView } from "../features/guia/GuiaRouter";

// ─── tipos da árvore vigente ─────────────────────────────────────────────────

// Sub-navegação interna do Atendimento (E02-S02/S03/S05) — mesmo padrão useState de abas, sem lib
// de rotas.
export type AtendimentoView = "dashboard" | "inbox" | "config";

// Sub-navegação interna do PCM (mesmo padrão useState de abas do resto do app — sem lib de rotas).
// "dashboard" = tela mock atual; "clientes" = lista mínima → Visão 360 (Task 18/E01-S12).
export type PcmView =
  | "dashboard"
  | "clientes"
  | "cliente-grupos"
  | "equipamentos"
  | "equipes"
  | "agenda-tecnico"
  | "relatorio-planejamento"
  | "relatorio-diario"
  | "relatorio-cliente"
  | "ferramentas"
  | "ferramentas-por-tecnico"
  | "funcionarios"
  | "tipos-tarefa"
  | "segmentos"
  | "palavras-chave"
  | "equipamento-categorias"
  | "chamados"
  | "ordens"
  | "backlog"
  | "inspecoes"
  | "assessment"
  | "cliente-marcacoes"
  | "pmoc"
  | "preventivas"
  | "laudos-spda"
  | "apontamento-horas"
  | "tipos-inspecao"
  | "sistemas";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  // Quando presente, o item navega (seta o PcmView). Itens sem `view` seguem decorativos (mock),
  // como já eram antes desta story — não são o foco do escopo enxuto da Task 18.
  view?: PcmView;
  // E01-S80 AC-2: atalho pra fora do módulo PCM — "Grupos de Usuário" abre o hub global de
  // Configurações na aba Grupos, reusando o mesmo `GruposPage` (nunca duplica o CRUD). `PCM_NAV` é
  // módulo-scoped (fora do componente), então o clique de fato é resolvido no render (tem acesso a
  // `navegarModulo`/`setConfigTab`); esta flag só marca a intenção nos dados estáticos.
  atalhoConfigGrupos?: boolean;
  // E01-S114: submenu simples (1 nível só) — item com `filhos` não navega por si (sem `view`
  // próprio), só expande/colapsa; os filhos é que navegam.
  filhos?: NavItem[];
}

export interface NavGroup {
  titulo: string;
  items: NavItem[];
}

export interface AtendimentoNavItem {
  label: string;
  icon: LucideIcon;
  view: AtendimentoView;
}

export interface AtendimentoNavGroup {
  titulo: string;
  items: AtendimentoNavItem[];
}

// Sub-navegação do Financeiro — E04-S01..S06 (specs/E04-S01-fundacao-financeiro/), protótipo
// navegável com dados fictícios (features/financeiro/mock/). Mesmo padrão useState de abas.
export interface FinanceiroNavItem {
  label: string;
  icon: LucideIcon;
  view: FinanceiroView;
}

export interface FinanceiroNavGroup {
  titulo: string;
  items: FinanceiroNavItem[];
}

// Sub-navegação do Comercial — E03-S01 (specs/E03-S01-fundacao-comercial/). Mesmo padrão useState
// de abas. Cresce com o épico: funil (S02), propostas (S04), contratos (S07), dashboard (S08).
export type ComercialView =
  | "dashboard"
  | "funil"
  | "contas"
  | "precificacao"
  | "config-funil"
  | "contratos";

export interface ComercialNavItem {
  label: string;
  icon: LucideIcon;
  view: ComercialView;
}

// Sub-navegação do Guia do SO — documentação de onboarding (features/guia/), último item da
// barra de módulos. Mesmo padrão useState de abas.
export interface GuiaNavItem {
  label: string;
  icon: LucideIcon;
  view: GuiaView;
}

export type ConfigTab =
  | "grupos"
  | "usuarios"
  | "capacidades"
  | "integracoes"
  | "ia"
  | "gasto-ia"
  | "priorizacao"
  | "localizacao-auvo"
  | "ativacao";

// ─── árvore vigente (movida de HomePage.tsx, verbatim) ───────────────────────

export const CONFIG_NAV: Array<{
  id: ConfigTab;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "grupos", label: "Grupos", icon: Users },
  { id: "usuarios", label: "Usuários", icon: UserCog },
  { id: "capacidades", label: "Capacidades", icon: UserCog },
  { id: "integracoes", label: "Integrações", icon: KeyRound },
  { id: "ia", label: "IA", icon: Sparkles },
  { id: "gasto-ia", label: "Gasto de IA", icon: DollarSign },
  { id: "priorizacao", label: "Priorização", icon: SlidersHorizontal },
  { id: "localizacao-auvo", label: "Localização Auvo", icon: MapPin },
  // E01-S188: diagnóstico/abertura de gates. Superadmin + flag (filtro aplicado onde o nav renderiza).
  { id: "ativacao", label: "Ativação de jornadas", icon: LockKeyhole },
];

export const ATENDIMENTO_NAV: AtendimentoNavGroup[] = [
  {
    titulo: "ATENDIMENTO",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, view: "dashboard" },
      { label: "Inbox", icon: MessageCircle, view: "inbox" },
      { label: "Config", icon: Settings, view: "config" },
    ],
  },
];

export const FINANCEIRO_NAV: FinanceiroNavGroup[] = [
  {
    titulo: "VISÃO GERAL",
    items: [{ label: "Dashboard", icon: LayoutDashboard, view: "dashboard" }],
  },
  {
    titulo: "CAIXA",
    items: [
      { label: "Lançamentos", icon: ClipboardList, view: "lancamentos" },
      { label: "Categorias", icon: LayoutGrid, view: "categorias" },
      { label: "Contas Bancárias", icon: Building2, view: "contas" },
      { label: "Importar Extrato", icon: Upload, view: "ofx" },
    ],
  },
  {
    titulo: "RECEBIMENTOS",
    items: [
      { label: "Contas a Receber", icon: TrendingUp, view: "receber" },
      { label: "Contratos", icon: FileText, view: "contratos" },
      { label: "Cobrança", icon: BellRing, view: "cobranca" },
    ],
  },
  {
    titulo: "PAGAMENTOS",
    items: [{ label: "Contas a Pagar", icon: TrendingDown, view: "pagar" }],
  },
  { titulo: "IMPOSTOS", items: [{ label: "Impostos", icon: Landmark, view: "impostos" }] },
  {
    titulo: "FECHAMENTO",
    items: [{ label: "Fechamento Mensal", icon: LockKeyhole, view: "fechamento" }],
  },
  {
    titulo: "RENTABILIDADE",
    items: [
      { label: "Rentabilidade", icon: PieChart, view: "rentabilidade" },
      { label: "Custos de Pessoal", icon: UserCog, view: "pessoal" },
    ],
  },
  {
    titulo: "GERENCIAL",
    items: [
      { label: "DRE", icon: FileBarChart, view: "dre" },
      { label: "Orçamento", icon: Target, view: "orcamento" },
      { label: "Cockpit", icon: Gauge, view: "cockpit" },
    ],
  },
];

export const COMERCIAL_NAV: ComercialNavItem[] = [
  { label: "Dashboard", icon: Gauge, view: "dashboard" },
  { label: "Funil", icon: Columns3, view: "funil" },
  { label: "Contas", icon: Briefcase, view: "contas" },
  { label: "Contratos", icon: FileSignature, view: "contratos" },
  { label: "Precificação", icon: Calculator, view: "precificacao" },
  { label: "Configuração do funil", icon: SlidersHorizontal, view: "config-funil" },
];

export const GUIA_NAV: GuiaNavItem[] = [
  { label: "Visão geral", icon: BookOpen, view: "visao-geral" },
  { label: "PCM · Operação", icon: HardHat, view: "pcm" },
  { label: "Atendimento · Zé", icon: Bot, view: "atendimento" },
  { label: "Comercial", icon: Briefcase, view: "comercial" },
  { label: "Financeiro", icon: BarChart3, view: "financeiro" },
  { label: "Marketing", icon: Megaphone, view: "marketing" },
  { label: "Cockpit", icon: LayoutDashboard, view: "cockpit" },
  { label: "Área do Cliente", icon: UserCircle, view: "area-cliente" },
  { label: "Papéis e permissões", icon: Users, view: "papeis" },
];

export const PCM_NAV: NavGroup[] = [
  {
    titulo: "OPERAÇÃO",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, view: "dashboard" },
      // E01-S118: "Chamados" e "Operação" viram um menu só (o board). Sempre se abre um Chamado, que
      // após tratativa deriva numa OS pro Auvo — é o mesmo item, em fases. Backlog GUT deixou de ser
      // item de nav (virou aba do board, ao lado do Calendário).
      { label: "Chamados", icon: Headset, view: "ordens" },
      { label: "Inspeções", icon: CheckCircle2, view: "inspecoes" },
      { label: "Assessment", icon: ClipboardCheck, view: "assessment" },
      { label: "Ferramentas por Técnico", icon: HardHat, view: "ferramentas-por-tecnico" },
      { label: "Agenda do Técnico", icon: Calendar, view: "agenda-tecnico" },
      { label: "PMOC", icon: Snowflake, view: "pmoc" },
      { label: "Preventivas", icon: Calendar, view: "preventivas" },
      { label: "Relatório", icon: FileBarChart, view: "relatorio-planejamento" },
    ],
  },
  {
    titulo: "CADASTROS",
    items: [
      { label: "Clientes", icon: Building2, view: "clientes" },
      { label: "Componentes", icon: Wrench, view: "equipamentos" },
      { label: "Sistemas", icon: Link2, view: "sistemas" },
      { label: "Ferramentas", icon: Package, view: "ferramentas" },
    ],
  },
  {
    // E01-S80 AC-2/AC-3: cadastros/parametrizações do PCM, reunidos aqui (saíram do topo da
    // sidebar operacional). "Grupos de Usuário" reusa o hub global de Configurações (E00-S09) —
    // não duplica o CRUD, só atalho (ver `atalhoConfigGrupos`).
    titulo: "CONFIGURAÇÕES",
    items: [
      { label: "Equipes", icon: Users, view: "equipes" },
      { label: "Funcionários", icon: UserCog, view: "funcionarios" },
      { label: "Tipos de Tarefa", icon: ClipboardList, view: "tipos-tarefa" },
      { label: "Grupos de Clientes", icon: Users, view: "cliente-grupos" },
      { label: "Marcações de Cliente", icon: Tag, view: "cliente-marcacoes" },
      { label: "Tipos de Inspeção", icon: CheckCircle2, view: "tipos-inspecao" },
      { label: "Categorias Equip.", icon: Wrench, view: "equipamento-categorias" },
      { label: "Segmentos", icon: LayoutGrid, view: "segmentos" },
      { label: "Grupos de Usuário", icon: UserCog, atalhoConfigGrupos: true },
      { label: "Palavras-chave", icon: FileText, view: "palavras-chave" },
    ],
  },
  {
    titulo: "RELATÓRIOS",
    items: [
      { label: "Relatório do Dia", icon: FileBarChart, view: "relatorio-diario" },
      { label: "Relatório do Cliente", icon: FileText, view: "relatorio-cliente" },
      { label: "Laudo SPDA", icon: Zap, view: "laudos-spda" },
      { label: "Apontamento de Horas", icon: Clock, view: "apontamento-horas" },
    ],
  },
];

// ─── árvore nova — Trabalho · Gestão · Administração (BL 013) ────────────────

export type Nivel = "trabalho" | "gestao" | "administracao";

/** Uma entrada de menu da árvore nova. `grupo` e `icone` são acréscimos ao desenho do `plan.md`
 * (que descrevia só o mínimo) — sem eles a sidebar perderia os subtítulos e os ícones que já
 * existem hoje, o que seria regressão visual sem decisão. */
export interface EntradaNav {
  readonly id: string;
  readonly label: string;
  readonly nivel: Nivel;
  readonly grupo: string;
  /** Módulo de negócio que governa a permissão (`config.minhas_permissoes`). */
  readonly modulo: string;
  /** Nível mínimo exigido no módulo. Default `leitura`. */
  readonly exigeNivel?: "leitura" | "escrita";
  /** Ausente quando a entrada não abre uma view do PCM — é o caso do atalho para o hub global
   * de Configurações (`atalhoConfigGrupos`). */
  readonly view?: PcmView;
  readonly icone: LucideIcon;
  /** Capacidade sensível de `config.sso_acoes` exigida, quando houver. Hoje nenhuma entrada usa:
   * `config.sso_autorizar_acao(p_acao, p_cliente_id)` exige um cliente real e não responde
   * "este usuário administra catálogos globais?". Quando `E00-S26` entregar a verificação sem
   * cliente, as entradas de Administração passam a declarar `cadastro.gerir` aqui — o campo já
   * existe e `navegacaoVisivel` já o respeita, para que a troca seja de dado, não de código. */
  readonly capacidade?: string;
  /** Ids de views antigas que esta entrada passou a conter (ver `rotas-legadas.ts`). */
  readonly absorveu?: readonly PcmView[];
  readonly atalhoConfigGrupos?: boolean;
}

/**
 * Árvore aprovada em BL 013 do Pacote Consolidado e detalhada na tabela do `plan.md`.
 *
 * O que ainda NÃO mudou aqui, e por quê:
 * - **Assessment** e **PMOC** continuam como entrada própria. Tirá-los do menu depende das
 *   migrations de classificação (tasks 6–8), que tocam dado de produção e exigem ADR +
 *   `/revisao-adversarial`. Removê-los antes disso deixaria os registros sem porta de entrada.
 * - **Sistemas** e **Componentes** continuam visíveis dentro de "Clientes e Estrutura". O
 *   `plan.md` os tira do menu principal porque a jornada da Visão 360 passaria a alcançá-los —
 *   e essa jornada é a task 12, que não está feita. Tirar agora é perder alcance (AC-7).
 * - **Central de Pendências** ainda não tem view no front; entra quando E01-S197 existir.
 */
export const NAVEGACAO_SSO: readonly EntradaNav[] = [
  // ── Trabalho — a rotina do operador, o que ele abre todo dia.
  {
    id: "trabalho.dashboard",
    label: "Dashboard",
    nivel: "trabalho",
    grupo: "ROTINA",
    modulo: "pcm",
    view: "dashboard",
    icone: LayoutDashboard,
  },
  {
    id: "trabalho.chamados",
    label: "Chamados",
    nivel: "trabalho",
    grupo: "ROTINA",
    modulo: "pcm",
    view: "ordens",
    icone: Headset,
    absorveu: ["chamados", "backlog"],
  },
  {
    id: "trabalho.inspecoes",
    label: "Inspeções",
    nivel: "trabalho",
    grupo: "ROTINA",
    modulo: "pcm",
    view: "inspecoes",
    icone: CheckCircle2,
  },
  {
    id: "trabalho.assessment",
    label: "Assessment",
    nivel: "trabalho",
    grupo: "ROTINA",
    modulo: "pcm",
    view: "assessment",
    icone: ClipboardCheck,
  },
  {
    id: "trabalho.pmoc",
    label: "PMOC",
    nivel: "trabalho",
    grupo: "ROTINA",
    modulo: "pcm",
    view: "pmoc",
    icone: Snowflake,
  },
  {
    id: "trabalho.preventivas",
    label: "Preventivas",
    nivel: "trabalho",
    grupo: "ROTINA",
    modulo: "pcm",
    view: "preventivas",
    icone: Calendar,
  },
  {
    // A "Agenda do Técnico" é absorvida aqui — mesma tela, nome que diz o que ela é na operação.
    id: "trabalho.planejamento",
    label: "Planejamento e Visitas",
    nivel: "trabalho",
    grupo: "PLANEJAMENTO E VISITAS",
    modulo: "pcm",
    view: "agenda-tecnico",
    icone: Calendar,
    absorveu: ["agenda-tecnico"],
  },
  {
    id: "estrutura.clientes",
    label: "Clientes",
    nivel: "trabalho",
    grupo: "CLIENTES E ESTRUTURA",
    modulo: "pcm",
    view: "clientes",
    icone: Building2,
  },
  {
    id: "estrutura.sistemas",
    label: "Sistemas",
    nivel: "trabalho",
    grupo: "CLIENTES E ESTRUTURA",
    modulo: "pcm",
    view: "sistemas",
    icone: Link2,
  },
  {
    id: "estrutura.componentes",
    label: "Componentes",
    nivel: "trabalho",
    grupo: "CLIENTES E ESTRUTURA",
    modulo: "pcm",
    view: "equipamentos",
    icone: Wrench,
  },
  {
    id: "relatorios.planejamento",
    label: "Relatório de Planejamento",
    nivel: "trabalho",
    grupo: "RELATÓRIOS",
    modulo: "pcm",
    view: "relatorio-planejamento",
    icone: FileBarChart,
  },
  {
    id: "relatorios.diario",
    label: "Relatório do Dia",
    nivel: "trabalho",
    grupo: "RELATÓRIOS",
    modulo: "pcm",
    view: "relatorio-diario",
    icone: FileBarChart,
  },
  {
    id: "relatorios.cliente",
    label: "Relatório do Cliente",
    nivel: "trabalho",
    grupo: "RELATÓRIOS",
    modulo: "pcm",
    view: "relatorio-cliente",
    icone: FileText,
  },
  {
    id: "relatorios.spda",
    label: "Laudo SPDA",
    nivel: "trabalho",
    grupo: "RELATÓRIOS",
    modulo: "pcm",
    view: "laudos-spda",
    icone: Zap,
  },
  {
    id: "relatorios.horas",
    label: "Apontamento de Horas",
    nivel: "trabalho",
    grupo: "RELATÓRIOS",
    modulo: "pcm",
    view: "apontamento-horas",
    icone: Clock,
  },

  // ── Gestão — quem organiza quem executa.
  {
    id: "gestao.equipes",
    label: "Equipes",
    nivel: "gestao",
    grupo: "EQUIPES E RECURSOS",
    modulo: "pcm",
    view: "equipes",
    icone: Users,
  },
  {
    id: "gestao.funcionarios",
    label: "Funcionários",
    nivel: "gestao",
    grupo: "EQUIPES E RECURSOS",
    modulo: "pcm",
    view: "funcionarios",
    icone: UserCog,
  },
  {
    id: "gestao.ferramentas",
    label: "Ferramentas",
    nivel: "gestao",
    grupo: "EQUIPES E RECURSOS",
    modulo: "pcm",
    view: "ferramentas",
    icone: Package,
  },
  {
    id: "gestao.ferramentas-tecnico",
    label: "Ferramentas por Técnico",
    nivel: "gestao",
    grupo: "EQUIPES E RECURSOS",
    modulo: "pcm",
    view: "ferramentas-por-tecnico",
    icone: HardHat,
  },

  // ── Administração — catálogo não é rotina. AC-5/AC-6: some para quem não tem autorização, e
  // o acesso por URL direta também é barrado (ver `exigeCapacidadeDeAdministracao`).
  {
    id: "admin.tipos-tarefa",
    label: "Tipos de Tarefa",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    modulo: "pcm",
    exigeNivel: "escrita",
    view: "tipos-tarefa",
    icone: ClipboardList,
  },
  {
    id: "admin.tipos-inspecao",
    label: "Tipos de Inspeção",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    modulo: "pcm",
    exigeNivel: "escrita",
    view: "tipos-inspecao",
    icone: CheckCircle2,
  },
  {
    id: "admin.categorias-equipamento",
    label: "Categorias Equip.",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    modulo: "pcm",
    exigeNivel: "escrita",
    view: "equipamento-categorias",
    icone: Wrench,
  },
  {
    id: "admin.segmentos",
    label: "Segmentos",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    modulo: "pcm",
    exigeNivel: "escrita",
    view: "segmentos",
    icone: LayoutGrid,
  },
  {
    id: "admin.palavras-chave",
    label: "Palavras-chave",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    modulo: "pcm",
    exigeNivel: "escrita",
    view: "palavras-chave",
    icone: FileText,
  },
  {
    id: "admin.grupos-cliente",
    label: "Grupos de Clientes",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    modulo: "pcm",
    exigeNivel: "escrita",
    view: "cliente-grupos",
    icone: Users,
  },
  {
    id: "admin.marcacoes-cliente",
    label: "Marcações de Cliente",
    nivel: "administracao",
    grupo: "CATÁLOGOS",
    modulo: "pcm",
    exigeNivel: "escrita",
    view: "cliente-marcacoes",
    icone: Tag,
  },
  {
    // Atalho para o hub global de Configurações (E00-S09) — não duplica o CRUD.
    id: "admin.grupos-usuario",
    label: "Grupos de Usuário",
    nivel: "administracao",
    grupo: "ACESSOS",
    modulo: "pcm",
    exigeNivel: "escrita",
    icone: UserCog,
    atalhoConfigGrupos: true,
  },
];

export const NIVEIS: readonly { readonly nivel: Nivel; readonly titulo: string }[] = [
  { nivel: "trabalho", titulo: "TRABALHO" },
  { nivel: "gestao", titulo: "GESTÃO" },
  { nivel: "administracao", titulo: "ADMINISTRAÇÃO" },
];

/**
 * AC-6 — ocultar é consequência da permissão, nunca lista fixa por papel.
 *
 * Função PURA: recebe o que o servidor já resolveu (`podeAcessar`, vindo de
 * `config.minhas_permissoes`, e o conjunto de capacidades concedidas) e devolve as entradas
 * visíveis. Não conhece papel, não tem `if (papel === 'supervisor')`, não lê `import.meta.env`.
 * O dia em que alguém precisar de um `if` por papel aqui, o desenho está errado: a resposta é
 * conceder a permissão, não listar o cargo.
 */
export function navegacaoVisivel(
  entradas: readonly EntradaNav[],
  podeAcessar: (modulo: string, nivel: "leitura" | "escrita") => boolean,
  capacidades: ReadonlySet<string>,
): readonly EntradaNav[] {
  return entradas.filter((entrada) => {
    if (!podeAcessar(entrada.modulo, entrada.exigeNivel ?? "leitura")) return false;
    if (entrada.capacidade && !capacidades.has(entrada.capacidade)) return false;
    return true;
  });
}

/** Entradas visíveis agrupadas por nível e, dentro dele, por grupo — na ordem da árvore. */
export function navegacaoAgrupada(entradas: readonly EntradaNav[]): readonly {
  readonly nivel: Nivel;
  readonly titulo: string;
  readonly grupos: readonly { readonly grupo: string; readonly itens: readonly EntradaNav[] }[];
}[] {
  return NIVEIS.map(({ nivel, titulo }) => {
    const doNivel = entradas.filter((e) => e.nivel === nivel);
    const grupos: { grupo: string; itens: EntradaNav[] }[] = [];
    for (const entrada of doNivel) {
      const existente = grupos.find((g) => g.grupo === entrada.grupo);
      if (existente) existente.itens.push(entrada);
      else grupos.push({ grupo: entrada.grupo, itens: [entrada] });
    }
    return { nivel, titulo, grupos };
  }).filter((bloco) => bloco.grupos.length > 0);
}

/**
 * AC-5/AC-6, task 13 — guarda de rota da Administração.
 *
 * Ocultar do menu não basta: o AC do Fabrício é explícito que "rotas ocultas também são
 * bloqueadas". Quem chegar numa view administrativa por deep-link, por estado antigo ou por
 * qualquer caminho que não seja o menu cai nesta verificação. Devolve a entrada bloqueada
 * (para a tela dizer qual recurso é) ou `null` quando o acesso é legítimo.
 */
export function bloqueioDeAdministracao(
  view: PcmView,
  podeAcessar: (modulo: string, nivel: "leitura" | "escrita") => boolean,
  capacidades: ReadonlySet<string>,
): EntradaNav | null {
  const entrada = NAVEGACAO_SSO.find((e) => e.nivel === "administracao" && e.view === view);
  if (!entrada) return null;
  const visiveis = navegacaoVisivel([entrada], podeAcessar, capacidades);
  return visiveis.length === 0 ? entrada : null;
}
