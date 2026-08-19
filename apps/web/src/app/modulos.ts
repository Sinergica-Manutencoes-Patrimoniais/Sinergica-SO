// E01-S147: extraído de HomePage.tsx pra evitar import circular com DashboardGeral.tsx (ambos
// precisam de MODULOS/ModuloId sem um depender do outro).
import {
  BarChart3,
  Bot,
  Briefcase,
  HardHat,
  Home,
  LayoutDashboard,
  Megaphone,
  UserCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ModuloId as ModuloNegocioId } from "../features/config/domain/modulo";

export type ModuloId = "inicio" | ModuloNegocioId;

// "config" não é módulo de negócio (não tem permissão por módulo) — é a área administrativa,
// visível só por papel (superadmin/supervisor), não por config.minhas_permissoes.
// "guia" também não é módulo permissionável — documentação visível a qualquer usuário logado,
// igual "config" (mas sem exigir papel administrativo).
export type AreaAtiva = ModuloId | "config" | "guia";

export function isModuloNegocio(id: ModuloId): id is ModuloNegocioId {
  return id !== "inicio";
}

export interface ModuloTab {
  id: ModuloId;
  label: string;
  icon: LucideIcon;
  descricao: string;
}

export const MODULOS: ModuloTab[] = [
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
