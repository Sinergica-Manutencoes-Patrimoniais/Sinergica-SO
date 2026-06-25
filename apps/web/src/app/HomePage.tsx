import {
  BarChart3,
  Bot,
  Briefcase,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileBarChart2,
  FileText,
  HardHat,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Megaphone,
  Package,
  Settings,
  TrendingDown,
  TrendingUp,
  UserCircle,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { useAuth } from "./auth-context";

// ─── tipos ──────────────────────────────────────────────────────────────────

type ModuloId =
  | "pcm"
  | "atendimento"
  | "comercial"
  | "financeiro"
  | "operacao"
  | "marketing"
  | "growth"
  | "gestao"
  | "area-cliente";

interface ModuloTab {
  id: ModuloId;
  label: string;
  icon: LucideIcon;
  descricao: string;
}

interface NavItem {
  label: string;
  icon: LucideIcon;
  active?: boolean;
}

interface NavGroup {
  titulo: string;
  items: NavItem[];
}

// ─── dados ───────────────────────────────────────────────────────────────────

const MODULOS: ModuloTab[] = [
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
    id: "operacao",
    label: "Estoque",
    icon: Package,
    descricao: "Catálogo de materiais, consumo via Auvo e controle de estoque.",
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    descricao: "Calendário editorial e geração de conteúdo com IA.",
  },
  {
    id: "growth",
    label: "Growth",
    icon: TrendingUp,
    descricao: "Leads, campanhas Meta/Google, atribuição e painel de ROAS.",
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

const PCM_NAV: NavGroup[] = [
  {
    titulo: "OPERAÇÃO",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, active: true },
      { label: "Ordens de Serviço", icon: ClipboardList },
      { label: "Backlog GUT", icon: LayoutGrid },
      { label: "Inspeções", icon: CheckCircle2 },
    ],
  },
  {
    titulo: "PREVENTIVO",
    items: [
      { label: "Cronograma", icon: Calendar },
      { label: "Preventivas", icon: Wrench },
    ],
  },
  {
    titulo: "RELATÓRIOS",
    items: [
      { label: "Relatório Diário", icon: FileText },
      { label: "Relatório Mensal", icon: FileBarChart2 },
      { label: "Laudo SPDA", icon: Zap },
    ],
  },
];

// ─── mock data ────────────────────────────────────────────────────────────────

const KPIS = [
  { label: "OS Abertas", valor: "12", sub: "+3 hoje", trend: "up", cor: "emerald" },
  { label: "Em Andamento", valor: "5", sub: "2 técnicos", trend: "neutro", cor: "blue" },
  { label: "Backlog Pendente", valor: "23", sub: "4 críticos", trend: "down", cor: "orange" },
  { label: "SLA no Prazo", valor: "87%", sub: "+2% vs. semana", trend: "up", cor: "emerald" },
  { label: "Inspeções (mês)", valor: "8", sub: "3 esta semana", trend: "up", cor: "blue" },
  { label: "Preventivas Pend.", valor: "4", sub: "vencem em 7 dias", trend: "down", cor: "orange" },
  { label: "Técnicos em Campo", valor: "3", sub: "1 disponível", trend: "neutro", cor: "blue" },
  { label: "Tempo Médio OS", valor: "2.3d", sub: "-0.4d vs. mês", trend: "up", cor: "emerald" },
];

const OS_RECENTES = [
  {
    numero: "CH-047",
    titulo: "Vazamento cano térreo",
    condominio: "Cond. Primavera",
    categoria: "Corretiva",
    prioridade: "critica",
    status: "solicitacao",
  },
  {
    numero: "CH-046",
    titulo: "Troca de lâmpada corredor",
    condominio: "Res. Vila Verde",
    categoria: "Corretiva",
    prioridade: "alta",
    status: "andamento",
  },
  {
    numero: "CH-045",
    titulo: "Portão eletrônico travado",
    condominio: "Res. Alamedas",
    categoria: "Corretiva",
    prioridade: "alta",
    status: "andamento",
  },
  {
    numero: "CH-044",
    titulo: "Revisão bomba d'água",
    condominio: "Ed. Central Park",
    categoria: "Preventiva",
    prioridade: "media",
    status: "planejado",
  },
  {
    numero: "CH-043",
    titulo: "Vistoria SPDA anual",
    condominio: "Cond. Jardins",
    categoria: "Preventiva",
    prioridade: "media",
    status: "solicitacao",
  },
];

const BACKLOG_TOP = [
  {
    titulo: "Infiltração fachada — causa raiz desconhecida",
    score: 125,
    prioridade: "critica",
    condominio: "Ed. Horizonte",
  },
  {
    titulo: "Quadro elétrico área comum sem proteção",
    score: 80,
    prioridade: "alta",
    condominio: "Res. Alamedas",
  },
  {
    titulo: "Elevador — manutenção atrasada 30 dias",
    score: 60,
    prioridade: "alta",
    condominio: "Cond. Primavera",
  },
];

// ─── helpers visuais ──────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  solicitacao: { label: "Solicitação", cls: "bg-slate-100 text-slate-600" },
  planejado: { label: "Planejado", cls: "bg-blue-50 text-blue-700" },
  andamento: { label: "Em andamento", cls: "bg-amber-50 text-amber-700" },
  concluido: { label: "Concluído", cls: "bg-emerald-50 text-emerald-700" },
};

const PRIO_MAP: Record<string, { label: string; dot: string }> = {
  critica: { label: "Crítica", dot: "bg-red-500" },
  alta: { label: "Alta", dot: "bg-orange-400" },
  media: { label: "Média", dot: "bg-yellow-400" },
  baixa: { label: "Baixa", dot: "bg-slate-300" },
};

const KPI_COR: Record<string, string> = {
  emerald: "text-emerald-600 bg-emerald-50",
  blue: "text-blue-600 bg-blue-50",
  orange: "text-orange-600 bg-orange-50",
};

// ─── componentes ─────────────────────────────────────────────────────────────

function KpiCard({ label, valor, sub, trend, cor }: (typeof KPIS)[number]) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-2 hover:shadow-sm transition-shadow">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-slate-900">{valor}</span>
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium ${
          trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-slate-400"
        }`}
      >
        {trend === "up" && <TrendingUp className="w-3 h-3" />}
        {trend === "down" && <TrendingDown className="w-3 h-3" />}
        {sub}
      </span>
    </div>
  );
}

function EmConstrucao({ modulo }: { modulo: ModuloTab }) {
  const Icon = modulo.icon;
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-12">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
        <Icon className="w-8 h-8 text-slate-400" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-700">{modulo.label}</h2>
        <p className="text-sm text-slate-400 mt-1 max-w-sm">{modulo.descricao}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Em construção
      </span>
    </div>
  );
}

function PcmDashboard() {
  return (
    <div className="flex flex-col gap-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPIS.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* OS recentes + Backlog top */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* OS recentes */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Ordens de Serviço Recentes</h3>
              <p className="text-xs text-slate-400 mt-0.5">Últimas 5 abertas ou atualizadas</p>
            </div>
            <span className="text-xs text-emerald-600 font-medium cursor-pointer hover:underline">
              Ver todas →
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {OS_RECENTES.map((os) => {
              const status = STATUS_MAP[os.status] ?? {
                label: os.status,
                cls: "bg-slate-100 text-slate-600",
              };
              const prio = PRIO_MAP[os.prioridade] ?? { label: os.prioridade, dot: "bg-slate-300" };
              return (
                <div
                  key={os.numero}
                  className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-default"
                >
                  <span className="text-xs font-mono text-slate-400 w-14 shrink-0">
                    {os.numero}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{os.titulo}</p>
                    <p className="text-xs text-slate-400 truncate">{os.condominio}</p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
                    <span className="text-slate-500">{prio.label}</span>
                  </span>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${status.cls}`}
                  >
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Backlog top */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Top Backlog GUT</h3>
            <p className="text-xs text-slate-400 mt-0.5">Itens com maior score de prioridade</p>
          </div>
          <div className="divide-y divide-slate-50">
            {BACKLOG_TOP.map((item, i) => {
              const prio = PRIO_MAP[item.prioridade] ?? {
                label: item.prioridade,
                dot: "bg-slate-300",
              };
              return (
                <div
                  key={item.titulo}
                  className="px-5 py-4 flex gap-3 hover:bg-slate-50 transition-colors cursor-default"
                >
                  <span className="text-xl font-bold text-slate-200 shrink-0 w-5 text-center leading-none mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 leading-snug">{item.titulo}</p>
                    <p className="text-xs text-slate-400 mt-1">{item.condominio}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-bold text-slate-600">Score {item.score}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium">
                        <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
                        <span className="text-slate-500">{prio.label}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── página principal ────────────────────────────────────────────────────────

export function HomePage() {
  const { user, logout } = useAuth();
  const [activeModulo, setActiveModulo] = useState<ModuloId>("pcm");

  const modulo = MODULOS.find((m) => m.id === activeModulo);
  const initials =
    user?.name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") ?? "?";
  const firstName = user?.name.split(" ")[0] ?? "usuário";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        {/* Brand */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-white" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">Sinérgica OS</p>
              <p className="text-[11px] text-slate-400 truncate capitalize">{user?.role}</p>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {activeModulo === "pcm" ? (
            PCM_NAV.map((group) => (
              <div key={group.titulo}>
                <p className="px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
                  {group.titulo}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                        item.active
                          ? "bg-emerald-50 text-emerald-700 font-medium"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="px-2 pt-4 text-center">
              <p className="text-xs text-slate-400">
                Navegação disponível quando o módulo for construído.
              </p>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-slate-100 space-y-0.5">
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 shrink-0" strokeWidth={1.8} />
            <span>Configurações</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.8} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar com abas */}
        <header className="bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-1 px-4 overflow-x-auto no-scrollbar">
            {MODULOS.map((m) => {
              const Icon = m.icon;
              const isActive = m.id === activeModulo;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveModulo(m.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer shrink-0 ${
                    isActive
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={isActive ? 2 : 1.8} />
                  {m.label}
                </button>
              );
            })}

            {/* Avatar no canto */}
            <div className="ml-auto pl-4 flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Greeting */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-900">Olá, {firstName}! 👋</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {activeModulo === "pcm"
                ? "Sinérgica Manutenções · PCM Operação"
                : `Sinérgica Manutenções · ${modulo?.label ?? ""}`}
            </p>
          </div>

          {/* Conteúdo por módulo */}
          {activeModulo === "pcm" || !modulo ? <PcmDashboard /> : <EmConstrucao modulo={modulo} />}
        </main>
      </div>
    </div>
  );
}
