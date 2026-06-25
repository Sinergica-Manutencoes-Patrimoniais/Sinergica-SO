import {
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  HardHat,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Settings,
  TrendingUp,
  UserCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "./auth-context";

interface Modulo {
  id: string;
  nome: string;
  descricao: string;
  icon: LucideIcon;
  cor: string;
  iconBg: string;
}

const MODULOS: Modulo[] = [
  {
    id: "pcm",
    nome: "PCM · Operação",
    descricao: "Ordens de serviço, backlog GUT, inspeções e preventivas.",
    icon: HardHat,
    cor: "border-blue-200 hover:border-blue-400",
    iconBg: "bg-blue-100 text-blue-700",
  },
  {
    id: "atendimento",
    nome: "Atendimento · Zé",
    descricao: "Agente IA no WhatsApp — abre chamados 24/7 sem intervenção humana.",
    icon: Bot,
    cor: "border-emerald-200 hover:border-emerald-400",
    iconBg: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "comercial",
    nome: "Comercial",
    descricao: "CRM, levantamentos, propostas com IA e gestão de contratos.",
    icon: Briefcase,
    cor: "border-violet-200 hover:border-violet-400",
    iconBg: "bg-violet-100 text-violet-700",
  },
  {
    id: "financeiro",
    nome: "Financeiro",
    descricao: "Faturamento, recebíveis, margem por contrato e alertas de inadimplência.",
    icon: BarChart3,
    cor: "border-orange-200 hover:border-orange-400",
    iconBg: "bg-orange-100 text-orange-700",
  },
  {
    id: "operacao",
    nome: "Operação · Estoque",
    descricao: "Catálogo de materiais, consumo via Auvo e controle de estoque.",
    icon: Package,
    cor: "border-amber-200 hover:border-amber-400",
    iconBg: "bg-amber-100 text-amber-700",
  },
  {
    id: "marketing",
    nome: "Marketing",
    descricao: "Calendário editorial e geração de conteúdo com IA.",
    icon: Megaphone,
    cor: "border-pink-200 hover:border-pink-400",
    iconBg: "bg-pink-100 text-pink-700",
  },
  {
    id: "growth",
    nome: "Growth",
    descricao: "Leads, campanhas Meta/Google, atribuição e painel de ROAS.",
    icon: TrendingUp,
    cor: "border-cyan-200 hover:border-cyan-400",
    iconBg: "bg-cyan-100 text-cyan-700",
  },
  {
    id: "gestao",
    nome: "Gestão · Cockpit",
    descricao: "KPIs operacionais, SLA, MRR e margem — visão consolidada para gestores.",
    icon: LayoutDashboard,
    cor: "border-indigo-200 hover:border-indigo-400",
    iconBg: "bg-indigo-100 text-indigo-700",
  },
  {
    id: "area-cliente",
    nome: "Área do Cliente",
    descricao: "Portal do síndico — chamados, histórico e download de relatórios.",
    icon: UserCircle,
    cor: "border-teal-200 hover:border-teal-400",
    iconBg: "bg-teal-100 text-teal-700",
  },
];

export function HomePage() {
  const { user, logout } = useAuth();

  const initials =
    user?.name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") ?? "?";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" strokeWidth={1.8} />
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">Sinérgica OS</span>
            <span className="hidden sm:inline text-slate-300 text-xs ml-1">
              · Sistema Operacional
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
              <span>{user?.name}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-slate-900">Olá, {user?.name.split(" ")[0]}!</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Bem-vindo ao Sinérgica OS. Acompanhe abaixo os módulos do sistema — cada um está sendo
            construído em sprint dedicada.
          </p>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3 mb-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
          <p className="text-sm text-blue-800 font-medium">
            Fase 1 em andamento — Casca do OS entregue. Módulos em construção sprint a sprint.
          </p>
          <span className="ml-auto text-xs text-blue-600 font-mono shrink-0">v0.1.0-alpha</span>
        </div>

        {/* Grid de módulos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULOS.map((mod) => (
            <ModuloCard key={mod.id} modulo={mod} />
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-12">
          Sinérgica OS · Padrão OS v2 · Desenvolvido pela{" "}
          <span className="font-semibold">Trívia Studio</span>
        </p>
      </main>
    </div>
  );
}

function ModuloCard({ modulo }: { modulo: Modulo }) {
  const Icon = modulo.icon;

  return (
    <div
      className={`
        group relative bg-white rounded-2xl border-2 p-5 transition-all duration-200
        cursor-default select-none
        ${modulo.cor}
        hover:shadow-md hover:-translate-y-0.5
      `}
    >
      {/* Badge "Em construção" */}
      <span className="absolute top-4 right-4 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Em construção
      </span>

      {/* Icon */}
      <div
        className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${modulo.iconBg}`}
      >
        <Icon className="w-5 h-5" strokeWidth={1.8} />
      </div>

      {/* Text */}
      <h3 className="font-semibold text-slate-900 text-sm mb-1">{modulo.nome}</h3>
      <p className="text-xs text-slate-500 leading-relaxed">{modulo.descricao}</p>

      {/* Divider + integrations hint */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
          {modulo.id}
        </span>
        <span className="text-[10px] text-slate-300">Em breve</span>
      </div>
    </div>
  );
}
