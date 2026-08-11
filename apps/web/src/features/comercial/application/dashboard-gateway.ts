/** Porta do dashboard comercial (E03-S08). Todas as RPCs (migration 0196) agregam server-side —
 * o gateway nunca faz `select` de `oportunidades`/`propostas` inteiras pro browser (AC-1). */

export interface ConversaoEtapa {
  etapaId: string;
  etapaNome: string;
  etapaOrdem: number;
  entraram: number;
  avancaram: number;
}

export interface CicloVenda {
  medianaDias: number | null;
  quantidade: number;
}

export interface WinLossLinha {
  categoria: "ganha" | "perdida";
  motivoNome: string | null;
  quantidade: number;
}

export interface TicketMedio {
  ticketMedioCentavos: number | null;
  quantidade: number;
  fonteContrato: number;
  fonteProposta: number;
  fonteEstimado: number;
}

/** AC-8: `null` em `descontoMedioPct` = "sem dados" (nenhuma proposta enviada no período), não
 * confundir com `0` (desconto médio zero é um resultado real possível). */
export interface DescontoMedio {
  descontoMedioPct: number | null;
  quantidade: number;
  pertoDoPiso: number;
}

export interface OrigemLead {
  origem: string;
  total: number;
  ganhas: number;
}

export interface PeriodoDashboard {
  inicio: string;
  fim: string;
}

export interface DashboardGateway {
  conversaoEtapas(periodo: PeriodoDashboard): Promise<ConversaoEtapa[]>;
  cicloVenda(periodo: PeriodoDashboard): Promise<CicloVenda>;
  winLoss(periodo: PeriodoDashboard): Promise<WinLossLinha[]>;
  ticketMedio(periodo: PeriodoDashboard): Promise<TicketMedio>;
  descontoMedio(periodo: PeriodoDashboard): Promise<DescontoMedio>;
  origemLeads(periodo: PeriodoDashboard): Promise<OrigemLead[]>;
}
