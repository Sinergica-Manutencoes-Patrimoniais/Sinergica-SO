/** Adapter Supabase do contrato comercial (E03-S07). Roda sob RLS.
 *
 * Criar/ativar/encerrar passam pelas RPCs (migration 0193) — nunca insert/update solto pra essas
 * três operações. Editar campos antes de ativar e listar são `select`/`update` direto, sob RLS
 * normal (mesmo padrão de `supabase-proposta-adapter.ts`, S04). */

import { supabase } from "../../../lib/supabase-client";
import type {
  ContratoGateway,
  EditarContratoCommand,
  EncerrarContratoCommand,
} from "../application/contrato-gateway";
import type { Contrato } from "../domain/contrato";

const CONTRATO_COLS =
  "id,proposta_id,cliente_id,tipo,valor_mensal_centavos,dia_vencimento,vigencia_inicio,vigencia_fim,reajuste_indice,reajuste_mes,escopo,status,encerrado_em,encerrado_motivo,financeiro_contrato_id,created_at";

interface ContratoRow {
  id: string;
  proposta_id: string;
  cliente_id: string;
  tipo: Contrato["tipo"];
  valor_mensal_centavos: number | null;
  dia_vencimento: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  reajuste_indice: string | null;
  reajuste_mes: number | null;
  escopo: unknown;
  status: Contrato["status"];
  encerrado_em: string | null;
  encerrado_motivo: string | null;
  financeiro_contrato_id: string | null;
  created_at: string;
}

function mapContrato(row: ContratoRow): Contrato {
  return {
    id: row.id,
    propostaId: row.proposta_id,
    clienteId: row.cliente_id,
    tipo: row.tipo,
    valorMensalCentavos: row.valor_mensal_centavos,
    diaVencimento: row.dia_vencimento,
    vigenciaInicio: row.vigencia_inicio,
    vigenciaFim: row.vigencia_fim,
    reajusteIndice: row.reajuste_indice,
    reajusteMes: row.reajuste_mes,
    escopo: row.escopo,
    status: row.status,
    encerradoEm: row.encerrado_em,
    encerradoMotivo: row.encerrado_motivo,
    financeiroContratoId: row.financeiro_contrato_id,
    criadoEm: row.created_at,
  };
}

export const supabaseContratoAdapter: ContratoGateway = {
  async listarContratos() {
    const { data, error } = await supabase
      .schema("comercial")
      .from("contratos")
      .select(CONTRATO_COLS)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as ContratoRow[]).map(mapContrato);
  },

  async listarContratosDaConta(clienteId: string) {
    const { data, error } = await supabase
      .schema("comercial")
      .from("contratos")
      .select(CONTRATO_COLS)
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as ContratoRow[]).map(mapContrato);
  },

  async criarContrato(propostaId: string) {
    const { data, error } = await supabase
      .schema("comercial")
      .rpc("fn_criar_contrato", { p_proposta_id: propostaId })
      .single();
    if (error) throw error;
    return mapContrato(data as ContratoRow);
  },

  async editarContrato(input: EditarContratoCommand) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.tipo !== undefined) patch.tipo = input.tipo;
    if (input.valorMensalCentavos !== undefined)
      patch.valor_mensal_centavos = input.valorMensalCentavos;
    if (input.diaVencimento !== undefined) patch.dia_vencimento = input.diaVencimento;
    if (input.vigenciaInicio !== undefined) patch.vigencia_inicio = input.vigenciaInicio;
    if (input.vigenciaFim !== undefined) patch.vigencia_fim = input.vigenciaFim;
    if (input.reajusteIndice !== undefined) patch.reajuste_indice = input.reajusteIndice;
    if (input.reajusteMes !== undefined) patch.reajuste_mes = input.reajusteMes;

    const { data, error } = await supabase
      .schema("comercial")
      .from("contratos")
      .update(patch)
      .eq("id", input.id)
      .select(CONTRATO_COLS)
      .single();
    if (error) throw error;
    return mapContrato(data as ContratoRow);
  },

  async ativarContrato(contratoId: string) {
    const { data, error } = await supabase
      .schema("comercial")
      .rpc("fn_ativar_contrato", { p_contrato_id: contratoId })
      .single();
    if (error) throw error;
    return mapContrato(data as ContratoRow);
  },

  async encerrarContrato(input: EncerrarContratoCommand) {
    const { data, error } = await supabase
      .schema("comercial")
      .rpc("fn_encerrar_contrato", {
        p_contrato_id: input.contratoId,
        p_motivo: input.motivo,
        p_data: input.data ?? new Date().toISOString().slice(0, 10),
      })
      .single();
    if (error) throw error;
    return mapContrato(data as ContratoRow);
  },
};
