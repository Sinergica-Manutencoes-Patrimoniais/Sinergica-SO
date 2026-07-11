import {
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileBarChart2,
  FileText,
  HardHat,
  Home,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Moon,
  Package,
  Settings,
  Snowflake,
  Sun,
  Ticket,
  UserCircle,
  UserCog,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { AtendimentoConfigPage } from "../features/atendimento/pages/AtendimentoConfigPage";
import { AtendimentoDashboardPage } from "../features/atendimento/pages/AtendimentoDashboardPage";
import { AtendimentoInboxPage } from "../features/atendimento/pages/AtendimentoInboxPage";
import type { ModuloId as ModuloNegocioId } from "../features/config/domain/modulo";
import { GruposPage } from "../features/config/pages/GruposPage";
import { UsuariosPage } from "../features/config/pages/UsuariosPage";
import { NovaOrdemServicoModal } from "../features/pcm/components/NovaOrdemServicoModal";
import { BacklogGutPage } from "../features/pcm/pages/BacklogGutPage";
import {
  EquipamentoCategoriasPage,
  PalavrasChavePage,
  ProdutoCategoriasPage,
  SegmentosPage,
} from "../features/pcm/pages/CatalogoSimplesPage";
import { ClienteGruposPage } from "../features/pcm/pages/ClienteGruposPage";
import { EquipamentosPage } from "../features/pcm/pages/EquipamentosPage";
import { EquipesPage } from "../features/pcm/pages/EquipesPage";
import { FerramentasPage } from "../features/pcm/pages/FerramentasPage";
import { FerramentasPorTecnicoPage } from "../features/pcm/pages/FerramentasPorTecnicoPage";
import { FuncionariosPage } from "../features/pcm/pages/FuncionariosPage";
import { InspecoesPage } from "../features/pcm/pages/InspecoesPage";
import { LaudosSpdaPage } from "../features/pcm/pages/LaudosSpdaPage";
import { ListaClientesPage } from "../features/pcm/pages/ListaClientesPage";
import { OrdensServicoPage } from "../features/pcm/pages/OrdensServicoPage";
import { PcmDashboardPage } from "../features/pcm/pages/PcmDashboardPage";
import { PmocPage } from "../features/pcm/pages/PmocPage";
import { ServicosPage } from "../features/pcm/pages/ServicosPage";
import { TicketsPage } from "../features/pcm/pages/TicketsPage";
import { TiposTarefaPage } from "../features/pcm/pages/TiposTarefaPage";
import { VisaoClientePage } from "../features/pcm/pages/VisaoClientePage";
import { useAuth } from "./auth-context";
import { usePermissoes } from "./permissoes-context";
import { useTheme } from "./theme-context";

// ─── tipos ──────────────────────────────────────────────────────────────────

type ModuloId = "inicio" | ModuloNegocioId;

// "config" não é módulo de negócio (não tem permissão por módulo) — é a área administrativa,
// visível só por papel (superadmin/supervisor), não por config.minhas_permissoes.
type AreaAtiva = ModuloId | "config";

function isModuloNegocio(id: ModuloId): id is ModuloNegocioId {
  return id !== "inicio";
}

interface ModuloTab {
  id: ModuloId;
  label: string;
  icon: LucideIcon;
  descricao: string;
}

// Sub-navegação interna do Atendimento (E02-S02/S03/S05) — mesmo padrão useState de abas, sem lib
// de rotas.
type AtendimentoView = "dashboard" | "inbox" | "config";

// Sub-navegação interna do PCM (mesmo padrão useState de abas do resto do app — sem lib de rotas).
// "dashboard" = tela mock atual; "clientes" = lista mínima → Visão 360 (Task 18/E01-S12).
type PcmView =
  | "dashboard"
  | "clientes"
  | "cliente-grupos"
  | "equipamentos"
  | "equipes"
  | "ferramentas"
  | "ferramentas-por-tecnico"
  | "funcionarios"
  | "tipos-tarefa"
  | "segmentos"
  | "servicos"
  | "palavras-chave"
  | "produto-categorias"
  | "equipamento-categorias"
  | "tickets"
  | "ordens"
  | "backlog"
  | "inspecoes"
  | "pmoc"
  | "laudos-spda";

interface NavItem {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  // Quando presente, o item navega (seta o PcmView). Itens sem `view` seguem decorativos (mock),
  // como já eram antes desta story — não são o foco do escopo enxuto da Task 18.
  view?: PcmView;
}

interface NavGroup {
  titulo: string;
  items: NavItem[];
}

interface AtendimentoNavItem {
  label: string;
  icon: LucideIcon;
  view: AtendimentoView;
}

interface AtendimentoNavGroup {
  titulo: string;
  items: AtendimentoNavItem[];
}

// ─── dados ───────────────────────────────────────────────────────────────────

const MODULOS: ModuloTab[] = [
  {
    id: "inicio",
    label: "Início",
    icon: Home,
    descricao: "Visão geral consolidada de todos os módulos do Sinérgica SO.",
  },
  {
    id: "pcm",
    label: "PCM · Operação",
    icon: HardHat,
    descricao: "Ordens de serviço, backlog GUT, inspeções e preventivas.",
  },
  {
    id: "atendimento",
    label: "Atendimento · Zé",
    icon: Bot,
    descricao: "Agente IA no WhatsApp — abre chamados 24/7 sem intervenção humana.",
  },
  {
    id: "comercial",
    label: "Comercial",
    icon: Briefcase,
    descricao: "CRM, levantamentos, propostas com IA e gestão de contratos.",
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: BarChart3,
    descricao: "Faturamento, recebíveis, margem por contrato e alertas de inadimplência.",
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    descricao:
      "Calendário editorial, geração de conteúdo com IA, leads e campanhas de aquisição (Growth).",
  },
  {
    id: "gestao",
    label: "Cockpit",
    icon: LayoutDashboard,
    descricao: "KPIs operacionais, SLA, MRR e margem — visão consolidada para gestores.",
  },
  {
    id: "area-cliente",
    label: "Área do Cliente",
    icon: UserCircle,
    descricao: "Portal do síndico — chamados, histórico e download de relatórios.",
  },
];

const CONFIG_NAV: Array<{ id: "grupos" | "usuarios"; label: string; icon: LucideIcon }> = [
  { id: "grupos", label: "Grupos", icon: Users },
  { id: "usuarios", label: "Usuários", icon: UserCog },
];

const ATENDIMENTO_NAV: AtendimentoNavGroup[] = [
  {
    titulo: "ATENDIMENTO",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, view: "dashboard" },
      { label: "Inbox", icon: MessageCircle, view: "inbox" },
      { label: "Config", icon: Settings, view: "config" },
    ],
  },
];

const PCM_NAV: NavGroup[] = [
  {
    titulo: "OPERAÇÃO",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, view: "dashboard" },
      { label: "Ordens de Serviço", icon: ClipboardList, view: "ordens" },
      { label: "Backlog GUT", icon: LayoutGrid, view: "backlog" },
      { label: "Inspeções", icon: CheckCircle2, view: "inspecoes" },
      { label: "Ferramentas por Técnico", icon: HardHat, view: "ferramentas-por-tecnico" },
      { label: "Tickets", icon: Ticket, view: "tickets" },
    ],
  },
  {
    titulo: "CADASTROS",
    items: [
      { label: "Clientes", icon: Building2, view: "clientes" },
      { label: "Grupos de Clientes", icon: Users, view: "cliente-grupos" },
      { label: "Equipamentos", icon: Wrench, view: "equipamentos" },
      { label: "Equipes", icon: Users, view: "equipes" },
      { label: "Ferramentas", icon: Package, view: "ferramentas" },
      { label: "Funcionários", icon: UserCog, view: "funcionarios" },
      { label: "Serviços", icon: Briefcase, view: "servicos" },
      { label: "Tipos de Tarefa", icon: ClipboardList, view: "tipos-tarefa" },
      { label: "Segmentos", icon: LayoutGrid, view: "segmentos" },
      { label: "Palavras-chave", icon: FileText, view: "palavras-chave" },
      { label: "Categorias Produto", icon: Package, view: "produto-categorias" },
      { label: "Categorias Equip.", icon: Wrench, view: "equipamento-categorias" },
    ],
  },
  {
    titulo: "PREVENTIVO",
    items: [
      { label: "PMOC", icon: Snowflake, view: "pmoc" },
      { label: "Cronograma", icon: Calendar },
      { label: "Preventivas", icon: Wrench },
    ],
  },
  {
    titulo: "RELATÓRIOS",
    items: [
      { label: "Relatório Diário", icon: FileText },
      { label: "Relatório Mensal", icon: FileBarChart2 },
      { label: "Laudo SPDA", icon: Zap, view: "laudos-spda" },
    ],
  },
];

// ─── mock data ────────────────────────────────────────────────────────────────

interface ModuloResumo {
  moduloId: ModuloId;
  kpis: Array<{ label: string; valor: string }>;
  alerta?: string;
}

const DASHBOARD_GERAL: ModuloResumo[] = [
  {
    moduloId: "pcm",
    kpis: [
      { label: "OS Abertas", valor: "12" },
      { label: "SLA no Prazo", valor: "87%" },
      { label: "Backlog", valor: "23 itens" },
    ],
  },
  {
    moduloId: "atendimento",
    kpis: [
      { label: "Chamados hoje", valor: "8" },
      { label: "Pendentes", valor: "3" },
    ],
  },
  {
    moduloId: "comercial",
    kpis: [
      { label: "Leads ativos", valor: "5" },
      { label: "Contratos ativos", valor: "3" },
    ],
  },
  {
    moduloId: "financeiro",
    kpis: [
      { label: "Recebido (mês)", valor: "R$ 48,5k" },
      { label: "Inadimplentes", valor: "1" },
    ],
    alerta: "1 contrato",
  },
  {
    moduloId: "marketing",
    kpis: [
      { label: "Publicações/sem.", valor: "3" },
      { label: "Alcance", valor: "1.2k" },
      { label: "Leads (mês)", valor: "12" },
    ],
  },
  {
    moduloId: "gestao",
    kpis: [
      { label: "Alertas críticos", valor: "0" },
      { label: "Score geral", valor: "94" },
    ],
  },
  {
    moduloId: "area-cliente",
    kpis: [
      { label: "Portais ativos", valor: "15" },
      { label: "OS via portal", valor: "2" },
    ],
  },
];

// ─── componentes ─────────────────────────────────────────────────────────────

function EmConstrucao({ modulo }: { modulo: ModuloTab }) {
  const Icon = modulo.icon;
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-12">
      <div className="w-16 h-16 rounded-2xl bg-line flex items-center justify-center">
        <Icon className="w-8 h-8 text-ink-3" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-ink-2">{modulo.label}</h2>
        <p className="text-sm text-ink-3 mt-1 max-w-sm">{modulo.descricao}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#B26A00] bg-orange-soft border border-[#F0D4B0] rounded-full px-3 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#E8731B]" />
        Em construção
      </span>
    </div>
  );
}

function DashboardGeral({
  resumos,
  onSelect,
}: {
  resumos: ModuloResumo[];
  onSelect: (id: ModuloId) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {resumos.map((resumo) => {
        const modulo = MODULOS.find((m) => m.id === resumo.moduloId);
        if (!modulo) return null;
        const Icon = modulo.icon;
        return (
          <div
            key={resumo.moduloId}
            className="group flex min-h-44 flex-col overflow-hidden rounded-[10px] border border-line bg-card shadow-[0_1px_2px_rgba(20,28,54,0.04)] transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-navy/20 hover:shadow-[0_10px_26px_rgba(20,28,54,0.08)]"
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 bg-navy px-3.5 py-2.5">
              <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-white" strokeWidth={1.8} />
              </div>
              <span className="text-sm font-semibold text-white flex-1 truncate">
                {modulo.label}
              </span>
              {resumo.alerta && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a1000] bg-amber rounded-full px-2 py-0.5 shrink-0">
                  ⚠ {resumo.alerta}
                </span>
              )}
            </div>

            {/* KPIs */}
            <div className="flex flex-1 flex-col gap-2 px-3.5 py-3">
              {resumo.kpis.map((kpi) => (
                <div key={kpi.label} className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-ink-3 truncate">{kpi.label}</span>
                  <span className="shrink-0 font-brand text-base font-bold tabular-nums text-ink">
                    {kpi.valor}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-3.5 pb-3">
              <button
                type="button"
                onClick={() => onSelect(resumo.moduloId)}
                className="w-full cursor-pointer rounded-[5px] py-1.5 text-center text-xs font-semibold text-orange transition-colors hover:bg-orange-soft hover:text-orange-deep"
              >
                Ver módulo →
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── página principal ────────────────────────────────────────────────────────

export function HomePage() {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const { podeAcessar } = usePermissoes();
  const [activeModulo, setActiveModulo] = useState<AreaAtiva>("inicio");
  const [configTab, setConfigTab] = useState<"grupos" | "usuarios">("grupos");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Sub-navegação do Atendimento (E02-S02) — só "inbox" por enquanto (E02-S03+ adiciona mais).
  const [atendimentoView, setAtendimentoView] = useState<AtendimentoView>("inbox");
  // Sub-navegação do PCM (Task 18/E01-S12) — mesmo padrão useState de abas, sem lib de rotas.
  const [pcmView, setPcmView] = useState<PcmView>("dashboard");
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);
  const [novaOsAberta, setNovaOsAberta] = useState(false);
  const [feedbackOs, setFeedbackOs] = useState<string | null>(null);
  const [pcmRefreshKey, setPcmRefreshKey] = useState(0);
  // E01-S49: deep-link do cliente-360 pra uma OS específica — guarda de onde veio pra oferecer
  // "voltar ao cliente" sem precisar de router. `seq` força o efeito em `OrdensServicoPage` a
  // reagir mesmo clicando duas vezes seguidas na MESMA OS (osId igual não mudaria de valor).
  const [osDeepLink, setOsDeepLink] = useState<{
    osId: string;
    origemClienteId: string;
    seq: number;
  } | null>(null);

  function navegarModulo(area: AreaAtiva) {
    setActiveModulo(area);
    setMobileSidebarOpen(false);
  }

  function irParaPcmView(view: PcmView) {
    setPcmView(view);
    setClienteSelecionado(null); // ao trocar de sub-tela, sai da Visão 360 de um cliente específico
    setOsDeepLink(null);
  }

  function abrirOsDoCliente(osId: string) {
    if (clienteSelecionado) {
      setOsDeepLink((atual) => ({
        osId,
        origemClienteId: clienteSelecionado,
        seq: (atual?.seq ?? 0) + 1,
      }));
    }
    setPcmView("ordens");
  }

  function voltarAoClienteDoDeepLink() {
    if (!osDeepLink) return;
    setClienteSelecionado(osDeepLink.origemClienteId);
    setPcmView("clientes");
    setOsDeepLink(null);
  }

  // AC-4: superadmin sempre vê tudo (claim user_modulos vem vazio pra ele — bypass, igual RLS);
  // demais papéis só veem módulo com ao menos leitura resolvida (config.minhas_permissoes).
  function podeVerModulo(id: ModuloId): boolean {
    if (!isModuloNegocio(id)) return true;
    return user?.papel === "superadmin" || podeAcessar(id, "leitura");
  }

  const podeGerenciarConfig = user?.papel === "superadmin" || user?.papel === "supervisor";
  const podeCriarOs = podeAcessar("pcm", "escrita");
  const dashboardVisivel = DASHBOARD_GERAL.filter((r) => podeVerModulo(r.moduloId));

  const modulo = MODULOS.find((m) => m.id === activeModulo);
  const initials =
    user?.nome
      .split(" ")
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() ?? "")
      .join("") ?? "?";
  const firstName = user?.nome.split(" ")[0] ?? "usuário";

  const greetingSub =
    activeModulo === "inicio"
      ? "Sinérgica Manutenções · Visão Geral"
      : activeModulo === "config"
        ? "Sinérgica Manutenções · Configurações"
        : `Sinérgica Manutenções · ${modulo?.label ?? ""}`;
  const sidebarCompacta = sidebarCollapsed && !mobileSidebarOpen;

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-navy-deep/55 backdrop-blur-[2px] lg:hidden"
        />
      )}
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-hidden border-r border-navy-line bg-navy-deep shadow-2xl transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${sidebarCollapsed ? "lg:w-14" : "lg:w-56"}`}
      >
        {/* Brand */}
        <div className="flex min-h-14 items-center border-b border-navy-line px-3 py-3">
          <div className={`flex flex-1 items-center ${sidebarCompacta ? "lg:justify-center" : ""}`}>
            {sidebarCompacta ? (
              <img
                src="/logos/logo-simbolo-laranja.png"
                alt="Sinérgica"
                className="w-8 h-8 object-contain shrink-0"
              />
            ) : (
              <img
                src="/logos/logo-horizontal-branco.png"
                alt="Sinérgica"
                className="h-7 object-contain"
              />
            )}
          </div>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileSidebarOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[#A8B0CC] hover:bg-white/[0.07] hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {activeModulo === "inicio" ? (
            <div>
              {!sidebarCompacta && (
                <p className="px-2 text-[10px] font-semibold text-[#A8B0CC] uppercase tracking-widest mb-1">
                  MÓDULOS
                </p>
              )}
              {MODULOS.filter((m) => m.id !== "inicio" && podeVerModulo(m.id)).map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    title={m.label}
                    onClick={() => navegarModulo(m.id)}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] text-sm transition-colors cursor-pointer border-l-2 border-transparent text-[#A8B0CC] hover:bg-white/[0.04] hover:text-white ${sidebarCompacta ? "justify-center" : ""}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                    {!sidebarCompacta && <span className="truncate">{m.label}</span>}
                  </button>
                );
              })}
            </div>
          ) : activeModulo === "config" ? (
            <div>
              {!sidebarCompacta && (
                <p className="px-2 text-[10px] font-semibold text-[#A8B0CC] uppercase tracking-widest mb-1">
                  CONFIGURAÇÕES
                </p>
              )}
              {CONFIG_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === configTab;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => {
                      setConfigTab(item.id);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] text-sm transition-colors cursor-pointer border-l-2 ${sidebarCompacta ? "justify-center" : ""} ${
                      isActive
                        ? "border-orange bg-white/[0.07] text-white font-medium"
                        : "border-transparent text-[#A8B0CC] hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                    {!sidebarCompacta && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ) : activeModulo === "pcm" ? (
            PCM_NAV.map((group) => (
              <div key={group.titulo}>
                {!sidebarCompacta && (
                  <p className="px-2 text-[10px] font-semibold text-[#A8B0CC] uppercase tracking-widest mb-1">
                    {group.titulo}
                  </p>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const view = item.view;
                  // Item ativo: com `view`, reflete a sub-tela atual; sem `view`, mantém o mock.
                  const isActive = view ? view === pcmView : item.active;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      title={item.label}
                      onClick={view ? () => irParaPcmView(view) : undefined}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] text-sm transition-colors cursor-pointer border-l-2 ${sidebarCompacta ? "justify-center" : ""} ${
                        isActive
                          ? "border-orange bg-white/[0.07] text-white font-medium"
                          : "border-transparent text-[#A8B0CC] hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                      {!sidebarCompacta && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          ) : activeModulo === "atendimento" ? (
            ATENDIMENTO_NAV.map((group) => (
              <div key={group.titulo}>
                {!sidebarCompacta && (
                  <p className="px-2 text-[10px] font-semibold text-[#A8B0CC] uppercase tracking-widest mb-1">
                    {group.titulo}
                  </p>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.view === atendimentoView;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      title={item.label}
                      onClick={() => {
                        setAtendimentoView(item.view);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] text-sm transition-colors cursor-pointer border-l-2 ${sidebarCompacta ? "justify-center" : ""} ${
                        isActive
                          ? "border-orange bg-white/[0.07] text-white font-medium"
                          : "border-transparent text-[#A8B0CC] hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                      {!sidebarCompacta && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            !sidebarCompacta && (
              <div className="px-2 pt-4 text-center">
                <p className="text-xs text-[#A8B0CC]">
                  Navegação disponível quando o módulo for construído.
                </p>
              </div>
            )
          )}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-navy-line space-y-0.5">
          <button
            type="button"
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden w-full items-center gap-2.5 rounded-[4px] border-l-2 border-transparent px-2 py-1.5 text-sm text-[#A8B0CC] transition-colors hover:bg-white/[0.04] hover:text-white lg:flex ${sidebarCompacta ? "justify-center" : ""}`}
          >
            {sidebarCompacta ? (
              <ChevronRight className="w-4 h-4 shrink-0" strokeWidth={1.8} />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                <span>Recolher</span>
              </>
            )}
          </button>
          {podeGerenciarConfig && (
            <button
              type="button"
              title="Configurações"
              onClick={() => navegarModulo("config")}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] text-sm transition-colors cursor-pointer border-l-2 ${sidebarCompacta ? "justify-center" : ""} ${
                activeModulo === "config"
                  ? "border-orange bg-white/[0.07] text-white font-medium"
                  : "border-transparent text-[#A8B0CC] hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" strokeWidth={1.8} />
              {!sidebarCompacta && <span>Configurações</span>}
            </button>
          )}
          <button
            type="button"
            title="Sair"
            onClick={logout}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] text-sm text-[#A8B0CC] hover:bg-white/[0.04] hover:text-white transition-colors cursor-pointer border-l-2 border-transparent ${sidebarCompacta ? "justify-center" : ""}`}
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.8} />
            {!sidebarCompacta && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar com abas */}
        <header className="bg-card border-b border-line shrink-0">
          <div className="flex min-h-12 items-center gap-1 overflow-x-auto px-3 no-scrollbar sm:px-4">
            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setMobileSidebarOpen(true)}
              className="sticky left-0 z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-line bg-card text-ink-2 hover:bg-line-soft lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            {MODULOS.filter((m) => podeVerModulo(m.id)).map((m) => {
              const Icon = m.icon;
              const isActive = m.id === activeModulo;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => navegarModulo(m.id)}
                  className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-3 text-xs font-medium transition-colors sm:px-3.5 sm:text-sm ${
                    isActive
                      ? "border-orange text-navy"
                      : "border-transparent text-ink-3 hover:text-ink hover:border-line"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-orange" : ""}`}
                    strokeWidth={isActive ? 2 : 1.8}
                  />
                  {m.label}
                </button>
              );
            })}

            {/* Avatar no canto */}
            <div className="ml-auto pl-4 flex items-center gap-2 shrink-0">
              <button
                type="button"
                title={mode === "dark" ? "Usar modo dia" : "Usar modo noite"}
                aria-label={mode === "dark" ? "Usar modo dia" : "Usar modo noite"}
                onClick={toggleMode}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-line text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
              >
                {mode === "dark" ? (
                  <Sun className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <Moon className="h-4 w-4" strokeWidth={2} />
                )}
              </button>
              <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
          {/* Greeting */}
          <div className="mb-4">
            <h1 className="text-lg font-bold text-ink">Olá, {firstName}! 👋</h1>
            <p className="text-sm text-ink-3 mt-0.5">{greetingSub}</p>
          </div>

          {/* Conteúdo por módulo */}
          {activeModulo === "inicio" ? (
            <DashboardGeral resumos={dashboardVisivel} onSelect={navegarModulo} />
          ) : activeModulo === "pcm" ? (
            pcmView === "clientes" ? (
              clienteSelecionado ? (
                // Visão 360 de um cliente específico. O botão "Voltar" é RE-navegação (não mutação),
                // por isso mora aqui e não dentro da VisaoClientePage — que segue read-only (AC-7).
                <div className="flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() => setClienteSelecionado(null)}
                    className="self-start inline-flex items-center gap-1.5 text-sm font-semibold text-orange hover:text-orange-deep cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                    Voltar para clientes
                  </button>
                  <VisaoClientePage clienteId={clienteSelecionado} onAbrirOs={abrirOsDoCliente} />
                </div>
              ) : (
                <ListaClientesPage onSelecionar={setClienteSelecionado} />
              )
            ) : pcmView === "inspecoes" ? (
              <InspecoesPage />
            ) : pcmView === "cliente-grupos" ? (
              <ClienteGruposPage />
            ) : pcmView === "funcionarios" ? (
              <FuncionariosPage />
            ) : pcmView === "equipamentos" ? (
              <EquipamentosPage />
            ) : pcmView === "equipes" ? (
              <EquipesPage />
            ) : pcmView === "ferramentas" ? (
              <FerramentasPage />
            ) : pcmView === "ferramentas-por-tecnico" ? (
              <FerramentasPorTecnicoPage />
            ) : pcmView === "tickets" ? (
              <TicketsPage />
            ) : pcmView === "servicos" ? (
              <ServicosPage />
            ) : pcmView === "tipos-tarefa" ? (
              <TiposTarefaPage />
            ) : pcmView === "segmentos" ? (
              <SegmentosPage />
            ) : pcmView === "palavras-chave" ? (
              <PalavrasChavePage />
            ) : pcmView === "produto-categorias" ? (
              <ProdutoCategoriasPage />
            ) : pcmView === "equipamento-categorias" ? (
              <EquipamentoCategoriasPage />
            ) : pcmView === "laudos-spda" ? (
              <LaudosSpdaPage />
            ) : pcmView === "pmoc" ? (
              <PmocPage />
            ) : pcmView === "ordens" ? (
              <div className="flex flex-col gap-4">
                {osDeepLink && (
                  <button
                    type="button"
                    onClick={voltarAoClienteDoDeepLink}
                    className="self-start inline-flex items-center gap-1.5 text-sm font-semibold text-orange hover:text-orange-deep cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                    Voltar ao cliente
                  </button>
                )}
                <OrdensServicoPage
                  refreshKey={pcmRefreshKey}
                  onNovaOs={() => setNovaOsAberta(true)}
                  osIdInicialToken={
                    osDeepLink ? `${osDeepLink.osId}::${osDeepLink.seq}` : undefined
                  }
                />
              </div>
            ) : pcmView === "backlog" ? (
              <BacklogGutPage />
            ) : (
              <div className="flex flex-col gap-4">
                {feedbackOs && (
                  <div className="rounded-[6px] border border-[#BFE5CB] bg-[#EFFAF2] px-4 py-2 text-sm text-[#1E7A3A]">
                    {feedbackOs}
                  </div>
                )}
                <PcmDashboardPage
                  refreshKey={pcmRefreshKey}
                  podeCriarOs={podeCriarOs}
                  onNovaOs={() => setNovaOsAberta(true)}
                  onVerOrdens={() => irParaPcmView("ordens")}
                  onVerBacklog={() => irParaPcmView("backlog")}
                />
              </div>
            )
          ) : activeModulo === "config" ? (
            configTab === "grupos" ? (
              <GruposPage />
            ) : (
              <UsuariosPage />
            )
          ) : activeModulo === "atendimento" ? (
            atendimentoView === "dashboard" ? (
              <AtendimentoDashboardPage />
            ) : atendimentoView === "inbox" ? (
              <AtendimentoInboxPage />
            ) : atendimentoView === "config" ? (
              <AtendimentoConfigPage />
            ) : null
          ) : modulo ? (
            <EmConstrucao modulo={modulo} />
          ) : null}
        </main>
      </div>
      {podeCriarOs && (
        <NovaOrdemServicoModal
          aberto={novaOsAberta}
          onFechar={() => setNovaOsAberta(false)}
          onCriada={(numero) => {
            setFeedbackOs(`OS ${numero} criada em solicitação.`);
            setPcmView("ordens");
            setClienteSelecionado(null);
            setPcmRefreshKey((atual) => atual + 1);
            setTimeout(() => setFeedbackOs(null), 5000);
          }}
        />
      )}
    </div>
  );
}
