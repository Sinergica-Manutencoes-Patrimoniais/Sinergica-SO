/** Adapter Supabase do dashboard comercial (E03-S08). Só chama RPC — nunca `select` das tabelas
 * base (AC-1: agregação sempre server-side). `security invoker` nas RPCs deixa a RLS de
 * `comercial.*` filtrar sozinha por `user_modulos.comercial` (migration 0196). */

import { supabase } from "../../../lib/supabase-client";
import type {
  CicloVenda,
  ConversaoEtapa,
  DashboardGateway,
  DescontoMedio,
  OrigemLead,
  PeriodoDashboard,
  TicketMedio,
  WinLossLinha,
} from "../application/dashboard-gateway";

function params(periodo: PeriodoDashboard) {
  return { p_inicio: periodo.inicio, p_fim: periodo.fim };
}

export const supabaseDashboardAdapter: DashboardGateway = {
  async conversaoEtapas(periodo) {
    const { data, error } = await supabase
      .schema("comercial")
      .rpc("fn_conversao_etapas", params(periodo));
    if (error) throw error;
    return (
      (data ?? []) as Array<{
        etapa_id: string;
        etapa_nome: string;
        etapa_ordem: number;
        entraram: number;
        avancaram: number;
      }>
    ).map((row) => ({
      etapaId: row.etapa_id,
      etapaNome: row.etapa_nome,
      etapaOrdem: row.etapa_ordem,
      entraram: row.entraram,
      avancaram: row.avancaram,
    })) satisfies ConversaoEtapa[];
  },

  async cicloVenda(periodo) {
    const { data, error } = await supabase
      .schema("comercial")
      .rpc("fn_ciclo_venda", params(periodo))
      .single();
    if (error) throw error;
    const row = data as { mediana_dias: number | null; quantidade: number };
    return { medianaDias: row.mediana_dias, quantidade: row.quantidade } satisfies CicloVenda;
  },

  async winLoss(periodo) {
    const { data, error } = await supabase.schema("comercial").rpc("fn_win_loss", params(periodo));
    if (error) throw error;
    return (
      (data ?? []) as Array<{
        categoria: "ganha" | "perdida";
        motivo_nome: string | null;
        quantidade: number;
      }>
    ).map((row) => ({
      categoria: row.categoria,
      motivoNome: row.motivo_nome,
      quantidade: row.quantidade,
    })) satisfies WinLossLinha[];
  },

  async ticketMedio(periodo) {
    const { data, error } = await supabase
      .schema("comercial")
      .rpc("fn_ticket_medio", params(periodo))
      .single();
    if (error) throw error;
    const row = data as {
      ticket_medio_centavos: number | null;
      quantidade: number;
      fonte_contrato: number;
      fonte_proposta: number;
      fonte_estimado: number;
    };
    return {
      ticketMedioCentavos: row.ticket_medio_centavos,
      quantidade: row.quantidade,
      fonteContrato: row.fonte_contrato,
      fonteProposta: row.fonte_proposta,
      fonteEstimado: row.fonte_estimado,
    } satisfies TicketMedio;
  },

  async descontoMedio(periodo) {
    const { data, error } = await supabase
      .schema("comercial")
      .rpc("fn_desconto_medio", params(periodo))
      .single();
    if (error) throw error;
    const row = data as {
      desconto_medio_pct: number | null;
      quantidade: number;
      perto_do_piso: number;
    };
    return {
      descontoMedioPct: row.desconto_medio_pct,
      quantidade: row.quantidade,
      pertoDoPiso: row.perto_do_piso,
    } satisfies DescontoMedio;
  },

  async origemLeads(periodo) {
    const { data, error } = await supabase
      .schema("comercial")
      .rpc("fn_origem_leads", params(periodo));
    if (error) throw error;
    return ((data ?? []) as Array<{ origem: string; total: number; ganhas: number }>).map(
      (row) => ({
        origem: row.origem,
        total: row.total,
        ganhas: row.ganhas,
      }),
    ) satisfies OrigemLead[];
  },
};
