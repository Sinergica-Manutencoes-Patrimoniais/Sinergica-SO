import { supabase } from "../../../lib/supabase-client";
import type {
  BaixarLancamentoCommand,
  CategoriaCommand,
  ConciliarTransacaoCommand,
  ContaBancariaCommand,
  ContratoCommand,
  CriarLancamentoDeTransacaoCommand,
  CustoFuncionarioCommand,
  DesativarCategoriaCommand,
  DesativarContaBancariaCommand,
  EditarCategoriaCommand,
  EditarContaBancariaCommand,
  EditarContratoCommand,
  EditarLancamentoCommand,
  EditarPontoReguaCommand,
  EditarRecorrenciaCommand,
  EstornarBaixaLancamentoCommand,
  FiltroLancamentos,
  FinanceiroGateway,
  LancamentoCommand,
  PontoReguaCommand,
  RecorrenciaCommand,
  RegraClassificacaoCommand,
  TransferenciaCommand,
} from "../application/financeiro-gateway";
import type { FaixaAging, RecebivelAging } from "../domain/aging";
import type { PagavelAging } from "../domain/aging-pagaveis";
import { diferencasLancamento } from "../domain/auditoria";
import type { CategoriaItem } from "../domain/categoria";
import type { CobrancaItem, CobrancaTipo } from "../domain/cobranca";
import type {
  ExtratoTransacaoItem,
  LancamentoPrevistoCandidato,
  RegraClassificacao,
  StatusExtratoTransacao,
} from "../domain/conciliacao";
import type { ContaBancariaItem } from "../domain/conta-bancaria";
import type { ContratoItem, ContratoStatus } from "../domain/contrato";
import type { GastoCategoria, PontoFluxoMensal, ResumoCaixa } from "../domain/dashboard";
import type { LinhaDre, OrcamentoRealizadoLinha } from "../domain/dre";
import type { FechamentoMensal } from "../domain/fechamento";
import type { ConfigImpostos, ProvisaoImposto } from "../domain/impostos";
import type { LancamentoItem } from "../domain/lancamento";
import type { TransacaoOfx } from "../domain/ofx";
import type { PontoProjecaoCaixa } from "../domain/projecao-caixa";
import type { RecorrenciaItem } from "../domain/recorrencia-pagavel";
import type { CanalCobranca, EnvioReguaItem, PontoReguaItem } from "../domain/regua-cobranca";
import type { CustoFuncionarioItem, RentabilidadeMes } from "../domain/rentabilidade";

interface CategoriaRow {
  id: string;
  nome: string;
  tipo: "entrada" | "saida";
  parent_id: string | null;
  ativo: boolean;
  seed: boolean;
}

interface ContaRow {
  id: string;
  nome: string;
  banco: string | null;
  saldo_inicial_centavos: number;
  saldo_inicial_em: string;
  ativo: boolean;
}

interface SaldoContaRow {
  conta_id: string;
  saldo_centavos: number;
}

interface LancamentoRow {
  id: string;
  tipo: "entrada" | "saida";
  status: "previsto" | "realizado";
  valor_centavos: number;
  data_competencia: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  categoria_id: string;
  conta_id: string | null;
  cliente_id: string | null;
  fornecedor_id: string | null;
  os_id: string | null;
  origem: "manual" | "ofx" | "recorrencia" | "transferencia";
  extrato_transacao_id: string | null;
  descricao: string | null;
  comprovante_path: string | null;
}

const CATEGORIA_COLS = "id,nome,tipo,parent_id,ativo,seed" as const;
const CONTA_COLS = "id,nome,banco,saldo_inicial_centavos,saldo_inicial_em,ativo" as const;
const LANCAMENTO_COLS =
  "id,tipo,status,valor_centavos,data_competencia,data_vencimento,data_pagamento,categoria_id,conta_id,cliente_id,fornecedor_id,os_id,origem,extrato_transacao_id,descricao,comprovante_path" as const;
const COMPROVANTES_BUCKET = "financeiro-comprovantes";

/** `supabase.functions.invoke` não repassa o corpo problem+json da Edge Function no `error.message`
 * (supabase-js só devolve "Edge Function returned a non-2xx status code") — extrai o `detail` real
 * de `error.context` (Response bruta) quando disponível, senão devolve o erro original. AC-5 de
 * E04-S09 exige "mensagem clara", não o texto genérico do client. */
async function erroDetalhado(error: unknown): Promise<Error> {
  const contexto = (error as { context?: Response })?.context;
  if (contexto && typeof contexto.json === "function") {
    try {
      const corpo = await contexto.clone().json();
      if (typeof corpo?.detail === "string" && corpo.detail) return new Error(corpo.detail);
    } catch {
      // corpo não era JSON (ou já consumido) — cai no erro original abaixo.
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}

function mapCategoria(row: CategoriaRow): CategoriaItem {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    parentId: row.parent_id,
    ativo: row.ativo,
    seed: row.seed,
  };
}

function mapConta(row: ContaRow, saldos: Map<string, number>): ContaBancariaItem {
  return {
    id: row.id,
    nome: row.nome,
    banco: row.banco,
    saldoInicialCentavos: row.saldo_inicial_centavos,
    saldoInicialEm: row.saldo_inicial_em,
    ativo: row.ativo,
    saldoAtualCentavos: saldos.get(row.id) ?? null,
  };
}

function mapLancamento(row: LancamentoRow): LancamentoItem {
  return {
    id: row.id,
    tipo: row.tipo,
    status: row.status,
    valorCentavos: row.valor_centavos,
    dataCompetencia: row.data_competencia,
    dataVencimento: row.data_vencimento,
    dataPagamento: row.data_pagamento,
    categoriaId: row.categoria_id,
    contaId: row.conta_id,
    clienteId: row.cliente_id,
    fornecedorId: row.fornecedor_id,
    osId: row.os_id,
    origem: row.origem,
    extratoTransacaoId: row.extrato_transacao_id,
    descricao: row.descricao,
    comprovantePath: row.comprovante_path,
  };
}

export const supabaseFinanceiroAdapter: FinanceiroGateway = {
  async listarClientesOpcoes() {
    const { data, error } = await supabase
      .schema("pcm")
      .from("clientes")
      .select("id,nome")
      .order("nome", { ascending: true });
    if (error) throw error;
    return (data ?? []) as { id: string; nome: string }[];
  },

  async listarCategorias() {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("categorias")
      .select(CATEGORIA_COLS)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as CategoriaRow[]).map(mapCategoria);
  },

  async criarCategoria(input: CategoriaCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("categorias")
      .insert({
        nome: input.nome,
        tipo: input.tipo,
        parent_id: input.parentId ?? null,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(CATEGORIA_COLS)
      .single();
    if (error) throw error;
    return mapCategoria(data as CategoriaRow);
  },

  async editarCategoria(input: EditarCategoriaCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("categorias")
      .update({
        nome: input.nome,
        tipo: input.tipo,
        parent_id: input.parentId ?? null,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(CATEGORIA_COLS)
      .single();
    if (error) throw error;
    return mapCategoria(data as CategoriaRow);
  },

  async desativarCategoria(input: DesativarCategoriaCommand) {
    const { error } = await supabase
      .schema("financeiro")
      .from("categorias")
      .update({ ativo: false, updated_at: new Date().toISOString(), updated_by: input.userId })
      .eq("id", input.id);
    if (error) throw error;
  },

  async listarContas() {
    const [{ data: contas, error: errContas }, { data: saldos, error: errSaldos }] =
      await Promise.all([
        supabase.schema("financeiro").from("contas_bancarias").select(CONTA_COLS).order("nome"),
        supabase.schema("financeiro").rpc("fn_saldo_contas"),
      ]);
    if (errContas) throw errContas;
    if (errSaldos) throw errSaldos;
    const mapaSaldos = new Map(
      ((saldos ?? []) as SaldoContaRow[]).map((s) => [s.conta_id, s.saldo_centavos]),
    );
    return ((contas ?? []) as ContaRow[]).map((row) => mapConta(row, mapaSaldos));
  },

  async criarConta(input: ContaBancariaCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("contas_bancarias")
      .insert({
        nome: input.nome,
        banco: input.banco,
        saldo_inicial_centavos: input.saldoInicialCentavos,
        saldo_inicial_em: input.saldoInicialEm,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(CONTA_COLS)
      .single();
    if (error) throw error;
    return mapConta(
      data as ContaRow,
      new Map([[(data as ContaRow).id, input.saldoInicialCentavos]]),
    );
  },

  async editarConta(input: EditarContaBancariaCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("contas_bancarias")
      .update({
        nome: input.nome,
        banco: input.banco,
        saldo_inicial_centavos: input.saldoInicialCentavos,
        saldo_inicial_em: input.saldoInicialEm,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(CONTA_COLS)
      .single();
    if (error) throw error;
    // saldo atual pode ter mudado com a alteração do saldo inicial/data de corte — recarregar via RPC
    const { data: saldoRow } = await supabase
      .schema("financeiro")
      .rpc("fn_saldo_contas")
      .eq("conta_id", input.id)
      .maybeSingle();
    const saldos = new Map<string, number>();
    if (saldoRow)
      saldos.set((saldoRow as SaldoContaRow).conta_id, (saldoRow as SaldoContaRow).saldo_centavos);
    return mapConta(data as ContaRow, saldos);
  },

  async desativarConta(input: DesativarContaBancariaCommand) {
    const { error } = await supabase
      .schema("financeiro")
      .from("contas_bancarias")
      .update({ ativo: false, updated_at: new Date().toISOString(), updated_by: input.userId })
      .eq("id", input.id);
    if (error) throw error;
  },

  async listarLancamentos(filtro?: FiltroLancamentos) {
    let query = supabase
      .schema("financeiro")
      .from("lancamentos")
      .select(LANCAMENTO_COLS)
      .order("data_competencia", { ascending: false });

    if (filtro?.competenciaInicio) query = query.gte("data_competencia", filtro.competenciaInicio);
    if (filtro?.competenciaFim) query = query.lte("data_competencia", filtro.competenciaFim);
    if (filtro?.tipo) query = query.eq("tipo", filtro.tipo);
    if (filtro?.status) query = query.eq("status", filtro.status);
    if (filtro?.categoriaId) query = query.eq("categoria_id", filtro.categoriaId);
    if (filtro?.contaId) query = query.eq("conta_id", filtro.contaId);
    if (filtro?.clienteId) query = query.eq("cliente_id", filtro.clienteId);

    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as LancamentoRow[]).map(mapLancamento);
  },

  async criarLancamento(input: LancamentoCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("lancamentos")
      .insert({
        tipo: input.tipo,
        status: input.status,
        valor_centavos: input.valorCentavos,
        data_competencia: input.dataCompetencia,
        data_vencimento: input.dataVencimento,
        data_pagamento: input.dataPagamento,
        categoria_id: input.categoriaId,
        conta_id: input.contaId,
        cliente_id: input.clienteId,
        fornecedor_id: input.fornecedorId,
        descricao: input.descricao,
        origem: "manual",
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(LANCAMENTO_COLS)
      .single();
    if (error) throw error;
    return mapLancamento(data as LancamentoRow);
  },

  async editarLancamento(input: EditarLancamentoCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("lancamentos")
      .update({
        tipo: input.tipo,
        status: input.status,
        valor_centavos: input.valorCentavos,
        data_competencia: input.dataCompetencia,
        data_vencimento: input.dataVencimento,
        data_pagamento: input.dataPagamento,
        categoria_id: input.categoriaId,
        conta_id: input.contaId,
        cliente_id: input.clienteId,
        fornecedor_id: input.fornecedorId,
        descricao: input.descricao,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(LANCAMENTO_COLS)
      .single();
    if (error) throw error;
    return mapLancamento(data as LancamentoRow);
  },

  async baixarLancamento(input: BaixarLancamentoCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("lancamentos")
      .update({
        status: "realizado",
        data_pagamento: input.dataPagamento,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .eq("status", "previsto")
      .select(LANCAMENTO_COLS)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new Error("Lançamento não está previsto (ou não existe) — baixa não aplicada.");
    return mapLancamento(data as LancamentoRow);
  },

  async estornarBaixaLancamento(input: EstornarBaixaLancamentoCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("lancamentos")
      .update({
        status: "previsto",
        data_pagamento: null,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .eq("status", "realizado")
      .is("extrato_transacao_id", null)
      .select(LANCAMENTO_COLS)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error(
        "Lançamento não está realizado, não existe, ou está conciliado — estorno não aplicado.",
      );
    }
    return mapLancamento(data as LancamentoRow);
  },

  async obterResumoCaixa() {
    const { data, error } = await supabase.schema("financeiro").rpc("fn_resumo_caixa").single();
    if (error) throw error;
    const row = data as {
      posicao_caixa_centavos: number;
      entradas_mes_centavos: number;
      saidas_mes_centavos: number;
      resultado_mes_centavos: number;
      a_receber_30d_centavos: number;
      a_pagar_30d_centavos: number;
      entradas_previstas_mes_centavos: number;
      saidas_previstas_mes_centavos: number;
    };
    const resumo: ResumoCaixa = {
      posicaoCaixaCentavos: row.posicao_caixa_centavos,
      entradasMesCentavos: row.entradas_mes_centavos,
      saidasMesCentavos: row.saidas_mes_centavos,
      resultadoMesCentavos: row.resultado_mes_centavos,
      aReceber30dCentavos: row.a_receber_30d_centavos,
      aPagar30dCentavos: row.a_pagar_30d_centavos,
      entradasPrevistasMesCentavos: row.entradas_previstas_mes_centavos,
      saidasPrevistasMesCentavos: row.saidas_previstas_mes_centavos,
    };
    return resumo;
  },

  async obterFluxoMensal(meses: number) {
    const { data, error } = await supabase
      .schema("financeiro")
      .rpc("fn_fluxo_mensal", { p_meses: meses });
    if (error) throw error;
    return (
      (data ?? []) as {
        mes: string;
        entradas_centavos: number;
        saidas_centavos: number;
        resultado_centavos: number;
      }[]
    ).map(
      (row): PontoFluxoMensal => ({
        mes: row.mes,
        entradasCentavos: row.entradas_centavos,
        saidasCentavos: row.saidas_centavos,
        resultadoCentavos: row.resultado_centavos,
      }),
    );
  },

  async obterGastosCategoria(inicio: string, fim: string) {
    const { data, error } = await supabase
      .schema("financeiro")
      .rpc("fn_gastos_categoria", { p_inicio: inicio, p_fim: fim });
    if (error) throw error;
    return ((data ?? []) as { categoria_id: string; total_centavos: number }[]).map(
      (row): GastoCategoria => ({
        categoriaId: row.categoria_id,
        totalCentavos: row.total_centavos,
      }),
    );
  },

  async listarContratos() {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("contratos")
      .select(CONTRATO_COLS)
      .order("inicio", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as ContratoRow[]).map(mapContrato);
  },

  async criarContrato(input: ContratoCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("contratos")
      .insert({
        cliente_id: input.clienteId,
        descricao: input.descricao,
        valor_mensal_centavos: input.valorMensalCentavos,
        dia_vencimento: input.diaVencimento,
        inicio: input.inicio,
        fim: input.fim,
        status: input.status,
        bloqueia_os_em_atraso: input.bloqueiaOsEmAtraso,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(CONTRATO_COLS)
      .single();
    if (error) throw error;
    return mapContrato(data as ContratoRow);
  },

  async editarContrato(input: EditarContratoCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("contratos")
      .update({
        cliente_id: input.clienteId,
        descricao: input.descricao,
        valor_mensal_centavos: input.valorMensalCentavos,
        dia_vencimento: input.diaVencimento,
        inicio: input.inicio,
        fim: input.fim,
        status: input.status,
        bloqueia_os_em_atraso: input.bloqueiaOsEmAtraso,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(CONTRATO_COLS)
      .single();
    if (error) throw error;
    return mapContrato(data as ContratoRow);
  },

  async gerarRecorrencias(competencia: string) {
    const { data, error } = await supabase
      .schema("financeiro")
      .rpc("fn_gerar_recorrencias", { p_competencia: competencia });
    if (error) throw error;
    return (data ?? 0) as number;
  },

  async listarAgingRecebiveis() {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("aging_recebiveis")
      .select(
        "lancamento_id,cliente_id,contrato_id,valor_centavos,data_vencimento,descricao,faixa,dias_atraso",
      )
      .order("data_vencimento", { ascending: true });
    if (error) throw error;
    return (
      (data ?? []) as {
        lancamento_id: string;
        cliente_id: string | null;
        contrato_id: string | null;
        valor_centavos: number;
        data_vencimento: string;
        descricao: string | null;
        faixa: FaixaAging;
        dias_atraso: number;
      }[]
    ).map(
      (row): RecebivelAging => ({
        lancamentoId: row.lancamento_id,
        clienteId: row.cliente_id,
        contratoId: row.contrato_id,
        valorCentavos: row.valor_centavos,
        dataVencimento: row.data_vencimento,
        descricao: row.descricao,
        faixa: row.faixa,
        diasAtraso: row.dias_atraso,
      }),
    );
  },
  async importarExtrato(contaId: string, transacoes: TransacaoOfx[]) {
    const linhas = transacoes.map((t) => ({
      conta_id: contaId,
      fitid: t.fitid,
      data: t.data,
      valor_centavos: t.valorCentavos,
      memo: t.memo,
      tipo_ofx: t.tipoOfx,
    }));
    const { data, error } = await supabase
      .schema("financeiro")
      .from("extrato_transacoes")
      .upsert(linhas, { onConflict: "conta_id,fitid", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    const novas = (data ?? []).length;
    return { novas, duplicadas: transacoes.length - novas };
  },

  async listarTransacoesPendentes(contaId?: string) {
    let query = supabase
      .schema("financeiro")
      .from("extrato_transacoes")
      .select(EXTRATO_COLS)
      .eq("status", "pendente")
      .order("data", { ascending: false });
    if (contaId) query = query.eq("conta_id", contaId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as ExtratoTransacaoRow[]).map(mapExtratoTransacao);
  },

  async listarRegrasClassificacao() {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("regras_classificacao")
      .select(REGRA_COLS)
      .order("padrao");
    if (error) throw error;
    return ((data ?? []) as RegraRow[]).map(mapRegra);
  },

  async criarRegraClassificacao(input: RegraClassificacaoCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("regras_classificacao")
      .insert({
        padrao: input.padrao,
        categoria_id: input.categoriaId,
        cliente_id: input.clienteId,
        fornecedor_id: input.fornecedorId,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(REGRA_COLS)
      .single();
    if (error) throw error;
    return mapRegra(data as RegraRow);
  },

  async listarLancamentosPrevistosPorConta(contaId: string) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("lancamentos")
      .select("id,conta_id,tipo,valor_centavos,data_vencimento")
      .eq("conta_id", contaId)
      .eq("status", "previsto");
    if (error) throw error;
    return (
      (data ?? []) as {
        id: string;
        conta_id: string;
        tipo: "entrada" | "saida";
        valor_centavos: number;
        data_vencimento: string | null;
      }[]
    ).map(
      (row): LancamentoPrevistoCandidato => ({
        id: row.id,
        contaId: row.conta_id,
        tipo: row.tipo,
        valorCentavos: row.valor_centavos,
        dataVencimento: row.data_vencimento,
      }),
    );
  },

  async conciliarTransacao(input: ConciliarTransacaoCommand) {
    const { error: errLanc } = await supabase
      .schema("financeiro")
      .from("lancamentos")
      .update({
        status: "realizado",
        data_pagamento: input.dataPagamento,
        extrato_transacao_id: input.transacaoId,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.lancamentoId)
      .eq("status", "previsto");
    if (errLanc) throw errLanc;

    const { error: errTx } = await supabase
      .schema("financeiro")
      .from("extrato_transacoes")
      .update({ status: "conciliado", lancamento_id: input.lancamentoId })
      .eq("id", input.transacaoId)
      .eq("status", "pendente");
    if (errTx) throw errTx;
  },

  async desfazerConciliacao(transacaoId: string, userId: string) {
    const { data: transacao, error: errBusca } = await supabase
      .schema("financeiro")
      .from("extrato_transacoes")
      .select("lancamento_id")
      .eq("id", transacaoId)
      .single();
    if (errBusca) throw errBusca;
    const lancamentoId = (transacao as { lancamento_id: string | null }).lancamento_id;

    if (lancamentoId) {
      const { error: errLanc } = await supabase
        .schema("financeiro")
        .from("lancamentos")
        .update({
          extrato_transacao_id: null,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq("id", lancamentoId);
      if (errLanc) throw errLanc;
    }

    const { error: errTx } = await supabase
      .schema("financeiro")
      .from("extrato_transacoes")
      .update({ status: "pendente", lancamento_id: null })
      .eq("id", transacaoId);
    if (errTx) throw errTx;
  },

  async criarLancamentoDeTransacao(input: CriarLancamentoDeTransacaoCommand) {
    const { data: transacao, error: errBusca } = await supabase
      .schema("financeiro")
      .from("extrato_transacoes")
      .select("conta_id,valor_centavos,data,memo")
      .eq("id", input.transacaoId)
      .single();
    if (errBusca) throw errBusca;
    const tx = transacao as {
      conta_id: string;
      valor_centavos: number;
      data: string;
      memo: string | null;
    };

    const { data: lancamento, error: errLanc } = await supabase
      .schema("financeiro")
      .from("lancamentos")
      .insert({
        tipo: tx.valor_centavos < 0 ? "saida" : "entrada",
        status: "realizado",
        valor_centavos: Math.abs(tx.valor_centavos),
        data_competencia: tx.data,
        data_pagamento: tx.data,
        categoria_id: input.categoriaId,
        conta_id: tx.conta_id,
        cliente_id: input.clienteId,
        fornecedor_id: input.fornecedorId,
        descricao: input.descricao ?? tx.memo,
        origem: "ofx",
        extrato_transacao_id: input.transacaoId,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(LANCAMENTO_COLS)
      .single();
    if (errLanc) throw errLanc;

    const { error: errTx } = await supabase
      .schema("financeiro")
      .from("extrato_transacoes")
      .update({ status: "conciliado", lancamento_id: (lancamento as LancamentoRow).id })
      .eq("id", input.transacaoId);
    if (errTx) throw errTx;

    return mapLancamento(lancamento as LancamentoRow);
  },

  async ignorarTransacao(transacaoId: string) {
    const { error } = await supabase
      .schema("financeiro")
      .from("extrato_transacoes")
      .update({ status: "ignorado" })
      .eq("id", transacaoId)
      .eq("status", "pendente");
    if (error) throw error;
  },

  async reverterIgnorarTransacao(transacaoId: string) {
    const { error } = await supabase
      .schema("financeiro")
      .from("extrato_transacoes")
      .update({ status: "pendente" })
      .eq("id", transacaoId)
      .eq("status", "ignorado");
    if (error) throw error;
  },
  async listarRecorrencias() {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("recorrencias")
      .select(RECORRENCIA_COLS)
      .order("descricao");
    if (error) throw error;
    return ((data ?? []) as RecorrenciaRow[]).map(mapRecorrencia);
  },

  async criarRecorrencia(input: RecorrenciaCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("recorrencias")
      .insert({
        descricao: input.descricao,
        valor_centavos: input.valorCentavos,
        dia_vencimento: input.diaVencimento,
        categoria_id: input.categoriaId,
        fornecedor_id: input.fornecedorId,
        conta_id: input.contaId,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(RECORRENCIA_COLS)
      .single();
    if (error) throw error;
    return mapRecorrencia(data as RecorrenciaRow);
  },

  async editarRecorrencia(input: EditarRecorrenciaCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("recorrencias")
      .update({
        descricao: input.descricao,
        valor_centavos: input.valorCentavos,
        dia_vencimento: input.diaVencimento,
        categoria_id: input.categoriaId,
        fornecedor_id: input.fornecedorId,
        conta_id: input.contaId,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(RECORRENCIA_COLS)
      .single();
    if (error) throw error;
    return mapRecorrencia(data as RecorrenciaRow);
  },

  async desativarRecorrencia(id: string, userId: string) {
    const { error } = await supabase
      .schema("financeiro")
      .from("recorrencias")
      .update({ ativo: false, updated_at: new Date().toISOString(), updated_by: userId })
      .eq("id", id);
    if (error) throw error;
  },

  async listarAgingPagaveis() {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("aging_pagaveis")
      .select(
        "lancamento_id,fornecedor_id,categoria_id,conta_id,valor_centavos,data_vencimento,descricao,faixa,dias_atraso",
      )
      .order("data_vencimento", { ascending: true });
    if (error) throw error;
    return (
      (data ?? []) as {
        lancamento_id: string;
        fornecedor_id: string | null;
        categoria_id: string;
        conta_id: string | null;
        valor_centavos: number;
        data_vencimento: string;
        descricao: string | null;
        faixa: PagavelAging["faixa"];
        dias_atraso: number;
      }[]
    ).map(
      (row): PagavelAging => ({
        lancamentoId: row.lancamento_id,
        fornecedorId: row.fornecedor_id,
        categoriaId: row.categoria_id,
        contaId: row.conta_id,
        valorCentavos: row.valor_centavos,
        dataVencimento: row.data_vencimento,
        descricao: row.descricao,
        faixa: row.faixa,
        diasAtraso: row.dias_atraso,
      }),
    );
  },

  async obterProjecaoCaixa(horizonteDias: number) {
    const { data, error } = await supabase
      .schema("financeiro")
      .rpc("fn_projecao_caixa", { p_horizonte_dias: horizonteDias });
    if (error) throw error;
    return (
      (data ?? []) as {
        dias_horizonte: number;
        data_limite: string;
        saldo_projetado_centavos: number;
        entradas_previstas_centavos: number;
        saidas_previstas_centavos: number;
      }[]
    ).map(
      (row): PontoProjecaoCaixa => ({
        diasHorizonte: row.dias_horizonte,
        dataLimite: row.data_limite,
        saldoProjetadoCentavos: row.saldo_projetado_centavos,
        entradasPrevistasCentavos: row.entradas_previstas_centavos,
        saidasPrevistasCentavos: row.saidas_previstas_centavos,
      }),
    );
  },
  async listarFuncionariosOpcoes() {
    const { data, error } = await supabase
      .schema("pcm")
      .from("funcionarios")
      .select("id,nome")
      .order("nome");
    if (error) throw error;
    return (data ?? []) as { id: string; nome: string }[];
  },

  async listarCustosFuncionario() {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("custos_funcionario")
      .select(CUSTO_FUNCIONARIO_COLS)
      .order("vigente_desde", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as CustoFuncionarioRow[]).map(mapCustoFuncionario);
  },

  async criarCustoFuncionario(input: CustoFuncionarioCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("custos_funcionario")
      .insert({
        funcionario_id: input.funcionarioId,
        custo_mensal_centavos: input.custoMensalCentavos,
        horas_mes_base: input.horasMesBase,
        vigente_desde: input.vigenteDesde,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(CUSTO_FUNCIONARIO_COLS)
      .single();
    if (error) throw error;
    return mapCustoFuncionario(data as CustoFuncionarioRow);
  },

  async obterRentabilidadeClienteMes(meses: number) {
    const { data, error } = await supabase
      .schema("financeiro")
      .rpc("fn_rentabilidade_cliente_mes", { p_meses: meses });
    if (error) throw error;
    return (
      (data ?? []) as {
        cliente_id: string;
        mes: string;
        receita_centavos: number;
        custo_mo_centavos: number;
        custo_despesas_centavos: number;
        horas_totais: number;
        horas_valoradas: number;
        margem_centavos: number;
        margem_percentual: number | null;
      }[]
    ).map(
      (row): RentabilidadeMes => ({
        clienteId: row.cliente_id,
        mes: row.mes,
        receitaCentavos: row.receita_centavos,
        custoMoCentavos: row.custo_mo_centavos,
        custoDespesasCentavos: row.custo_despesas_centavos,
        horasTotais: Number(row.horas_totais),
        horasValoradas: Number(row.horas_valoradas),
        margemCentavos: row.margem_centavos,
        margemPercentual: row.margem_percentual,
      }),
    );
  },

  async obterCustoOsPorClienteMes(clienteId: string, mes: string) {
    const { data, error } = await supabase
      .schema("financeiro")
      .rpc("fn_custo_os_por_cliente_mes", { p_cliente_id: clienteId, p_mes: mes });
    if (error) throw error;
    return (
      (data ?? []) as {
        os_id: string;
        numero: string;
        data: string;
        tecnico_funcionario_id: string | null;
        horas: number;
        custo_hora_reais: number | null;
        custo_mo_centavos: number;
        despesa_centavos: number;
        valorado: boolean;
      }[]
    ).map((row) => ({
      osId: row.os_id,
      numero: row.numero,
      data: row.data,
      tecnicoFuncionarioId: row.tecnico_funcionario_id,
      horas: Number(row.horas),
      custoHoraReais: row.custo_hora_reais,
      custoMoCentavos: row.custo_mo_centavos,
      despesaCentavos: row.despesa_centavos,
      valorado: row.valorado,
    }));
  },

  // ── E04-S07: robustez operacional (comprovante/correção/estorno/transferência) ─────────────

  async anexarComprovante(lancamentoId: string, arquivo: File) {
    const extensao = arquivo.name.split(".").pop() ?? "bin";
    const path = `${lancamentoId}/${crypto.randomUUID()}.${extensao}`;
    const upload = await supabase.storage
      .from(COMPROVANTES_BUCKET)
      .upload(path, arquivo, { contentType: arquivo.type || undefined });
    if (upload.error) throw upload.error;

    const { error } = await supabase
      .schema("financeiro")
      .from("lancamentos")
      .update({ comprovante_path: path })
      .eq("id", lancamentoId);
    if (error) throw error;
    return path;
  },

  async urlAssinadaComprovante(path: string) {
    const { data, error } = await supabase.storage
      .from(COMPROVANTES_BUCKET)
      .createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  async corrigirLancamento(input: EditarLancamentoCommand) {
    const atual = await supabase
      .schema("financeiro")
      .from("lancamentos")
      .select(LANCAMENTO_COLS)
      .eq("id", input.id)
      .single();
    if (atual.error) throw atual.error;
    const anterior = mapLancamento(atual.data as LancamentoRow);

    const { data, error } = await supabase
      .schema("financeiro")
      .from("lancamentos")
      .update({
        valor_centavos: input.valorCentavos,
        categoria_id: input.categoriaId,
        data_competencia: input.dataCompetencia,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(LANCAMENTO_COLS)
      .single();
    if (error) throw error;
    const novo = mapLancamento(data as LancamentoRow);

    const eventos = diferencasLancamento(anterior, novo).map((evento) => ({
      lancamento_id: input.id,
      tipo: "correcao" as const,
      campo: evento.campo,
      valor_anterior: evento.valorAnterior,
      valor_novo: evento.valorNovo,
      created_by: input.userId,
    }));
    if (eventos.length > 0) {
      const insertEventos = await supabase
        .schema("financeiro")
        .from("lancamentos_eventos")
        .insert(eventos);
      if (insertEventos.error) throw insertEventos.error;
    }
    return novo;
  },

  async estornarLancamentoRealizado(lancamentoId: string, userId: string) {
    const atual = await supabase
      .schema("financeiro")
      .from("lancamentos")
      .select(LANCAMENTO_COLS)
      .eq("id", lancamentoId)
      .eq("status", "realizado")
      .is("extrato_transacao_id", null)
      .maybeSingle();
    if (atual.error) throw atual.error;
    if (!atual.data) {
      throw new Error(
        "Lançamento não está realizado, não existe, ou está conciliado — estorno não aplicado.",
      );
    }
    const anterior = mapLancamento(atual.data as LancamentoRow);

    const evento = await supabase
      .schema("financeiro")
      .from("lancamentos_eventos")
      .insert({
        lancamento_id: lancamentoId,
        tipo: "estorno" as const,
        campo: "status",
        valor_anterior: `realizado (valor: ${anterior.valorCentavos})`,
        valor_novo: "excluído",
        created_by: userId,
      });
    if (evento.error) throw evento.error;

    const { error } = await supabase
      .schema("financeiro")
      .from("lancamentos")
      .delete()
      .eq("id", lancamentoId);
    if (error) throw error;
  },

  async criarTransferencia(input: TransferenciaCommand) {
    const { data, error } = await supabase.schema("financeiro").rpc("fn_criar_transferencia", {
      p_conta_origem_id: input.contaOrigemId,
      p_conta_destino_id: input.contaDestinoId,
      p_valor_centavos: input.valorCentavos,
      p_data: input.data,
      p_descricao: input.descricao ?? null,
    });
    if (error) throw error;
    return data as string;
  },

  // ── E04-S08: régua de cobrança ──────────────────────────────────────────────────────────────

  async listarPontosRegua() {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("regua_pontos")
      .select(REGUA_PONTO_COLS)
      .order("dia_offset", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as ReguaPontoRow[]).map(mapReguaPonto);
  },

  async criarPontoRegua(input: PontoReguaCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("regua_pontos")
      .insert({
        dia_offset: input.diaOffset,
        canal: input.canal,
        mensagem_modelo: input.mensagemModelo,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(REGUA_PONTO_COLS)
      .single();
    if (error) throw error;
    return mapReguaPonto(data as ReguaPontoRow);
  },

  async editarPontoRegua(input: EditarPontoReguaCommand) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("regua_pontos")
      .update({
        dia_offset: input.diaOffset,
        canal: input.canal,
        mensagem_modelo: input.mensagemModelo,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(REGUA_PONTO_COLS)
      .single();
    if (error) throw error;
    return mapReguaPonto(data as ReguaPontoRow);
  },

  async desativarPontoRegua(id: string, userId: string) {
    const { error } = await supabase
      .schema("financeiro")
      .from("regua_pontos")
      .update({ ativo: false, updated_at: new Date().toISOString(), updated_by: userId })
      .eq("id", id);
    if (error) throw error;
  },

  async listarEnviosRegua(lancamentoId?: string) {
    let query = supabase
      .schema("financeiro")
      .from("regua_envios")
      .select(REGUA_ENVIO_COLS)
      .order("enviado_em", { ascending: false });
    if (lancamentoId) query = query.eq("lancamento_id", lancamentoId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as ReguaEnvioRow[]).map(mapReguaEnvio);
  },

  // ── E04-S09: cobrança boleto/PIX (Mercado Pago) ─────────────────────────────────────────────

  async emitirCobranca(lancamentoId: string, tipo: CobrancaTipo) {
    const { data, error } = await supabase.functions.invoke("financeiro-cobranca-emitir", {
      body: { lancamentoId, tipo },
    });
    if (error) throw await erroDetalhado(error);
    return mapCobranca(data as CobrancaRow);
  },

  async listarCobrancasPorLancamento(lancamentoId: string) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("cobrancas")
      .select(COBRANCA_COLS)
      .eq("lancamento_id", lancamentoId)
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as CobrancaRow[]).map(mapCobranca);
  },

  // ── E04-S10: impostos (provisão Simples Nacional/DAS) ───────────────────────────────────────

  async obterConfigImpostos() {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("config_impostos")
      .select(CONFIG_IMPOSTOS_COLS)
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapConfigImpostos(data as ConfigImpostosRow) : null;
  },

  async salvarConfigImpostos(input: ConfigImpostos & { userId: string }) {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("config_impostos")
      .upsert(
        {
          id: 1,
          tipo: input.tipo,
          aliquota_fixa: input.aliquotaFixa,
          faixas: input.faixas,
          dia_vencimento: input.diaVencimento,
          ativo: true,
          updated_at: new Date().toISOString(),
          updated_by: input.userId,
        },
        { onConflict: "id" },
      )
      .select(CONFIG_IMPOSTOS_COLS)
      .single();
    if (error) throw error;
    return mapConfigImpostos(data as ConfigImpostosRow);
  },

  async provisionarImposto(competencia: string) {
    const { data, error } = await supabase
      .schema("financeiro")
      .rpc("fn_provisionar_imposto", { p_competencia: competencia })
      .single();
    if (error) throw error;
    return mapProvisaoImposto(data as ProvisaoImpostoRow);
  },

  async listarProvisoesImposto() {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("provisoes_imposto")
      .select(
        "competencia,receita_centavos,rbt12_centavos,aliquota_efetiva,valor_centavos,lancamento_id",
      )
      .order("competencia", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as ProvisaoImpostoRow[]).map(mapProvisaoImposto);
  },

  // ── E04-S11: fechamento mensal ───────────────────────────────────────────────────────────────

  async listarFechamentos() {
    const { data, error } = await supabase
      .schema("financeiro")
      .from("fechamentos_mensais")
      .select("competencia,status,updated_at,updated_by")
      .order("competencia", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as FechamentoRow[]).map(mapFechamento);
  },

  async fecharMes(competencia: string, motivo?: string | null) {
    const { error } = await supabase
      .schema("financeiro")
      .rpc("fn_fechar_mes", { p_competencia: competencia, p_motivo: motivo ?? null });
    if (error) throw error;
  },

  async reabrirMes(competencia: string, motivo: string) {
    const { error } = await supabase
      .schema("financeiro")
      .rpc("fn_reabrir_mes", { p_competencia: competencia, p_motivo: motivo });
    if (error) throw error;
  },

  // ── E04-S12: DRE + orçamento ─────────────────────────────────────────────────────────────────

  async obterDreMensal(meses: number) {
    const { data, error } = await supabase
      .schema("financeiro")
      .rpc("fn_dre_mensal", { p_meses: meses });
    if (error) throw error;
    return (
      (data ?? []) as {
        mes: string;
        tipo: "entrada" | "saida";
        categoria_raiz_nome: string;
        valor_centavos: number;
      }[]
    ).map(
      (row): LinhaDre => ({
        mes: row.mes,
        tipo: row.tipo,
        categoriaRaizNome: row.categoria_raiz_nome,
        valorCentavos: row.valor_centavos,
      }),
    );
  },

  async obterOrcamentoRealizado(ano: number) {
    const { data, error } = await supabase
      .schema("financeiro")
      .rpc("fn_orcamento_realizado", { p_ano: ano });
    if (error) throw error;
    return (
      (data ?? []) as {
        categoria_id: string;
        categoria_nome: string;
        mes: string;
        orcado_centavos: number;
        realizado_centavos: number;
        tem_orcamento: boolean;
      }[]
    ).map(
      (row): OrcamentoRealizadoLinha => ({
        categoriaId: row.categoria_id,
        categoriaNome: row.categoria_nome,
        mes: row.mes,
        orcadoCentavos: row.orcado_centavos,
        realizadoCentavos: row.realizado_centavos,
        temOrcamento: row.tem_orcamento,
      }),
    );
  },

  async salvarOrcamentoAnual(
    categoriaId: string,
    ano: number,
    valorMensalCentavos: number,
    userId: string,
  ) {
    const linhas = Array.from({ length: 12 }, (_, i) => ({
      categoria_id: categoriaId,
      competencia: `${ano}-${String(i + 1).padStart(2, "0")}-01`,
      valor_centavos: valorMensalCentavos,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    }));
    const { error } = await supabase
      .schema("financeiro")
      .from("orcamentos")
      .upsert(linhas, { onConflict: "categoria_id,competencia" });
    if (error) throw error;
  },
};

interface CustoFuncionarioRow {
  id: string;
  funcionario_id: string;
  custo_mensal_centavos: number;
  horas_mes_base: number;
  vigente_desde: string;
}

const CUSTO_FUNCIONARIO_COLS =
  "id,funcionario_id,custo_mensal_centavos,horas_mes_base,vigente_desde" as const;

function mapCustoFuncionario(row: CustoFuncionarioRow): CustoFuncionarioItem {
  return {
    id: row.id,
    funcionarioId: row.funcionario_id,
    custoMensalCentavos: row.custo_mensal_centavos,
    horasMesBase: Number(row.horas_mes_base),
    vigenteDesde: row.vigente_desde,
  };
}

interface RecorrenciaRow {
  id: string;
  descricao: string;
  valor_centavos: number;
  dia_vencimento: number;
  categoria_id: string;
  fornecedor_id: string | null;
  conta_id: string | null;
  ativo: boolean;
}

const RECORRENCIA_COLS =
  "id,descricao,valor_centavos,dia_vencimento,categoria_id,fornecedor_id,conta_id,ativo" as const;

function mapRecorrencia(row: RecorrenciaRow): RecorrenciaItem {
  return {
    id: row.id,
    descricao: row.descricao,
    valorCentavos: row.valor_centavos,
    diaVencimento: row.dia_vencimento,
    categoriaId: row.categoria_id,
    fornecedorId: row.fornecedor_id,
    contaId: row.conta_id,
    ativo: row.ativo,
  };
}

interface ExtratoTransacaoRow {
  id: string;
  conta_id: string;
  fitid: string;
  data: string;
  valor_centavos: number;
  memo: string | null;
  tipo_ofx: string | null;
  status: StatusExtratoTransacao;
  lancamento_id: string | null;
}

const EXTRATO_COLS =
  "id,conta_id,fitid,data,valor_centavos,memo,tipo_ofx,status,lancamento_id" as const;

function mapExtratoTransacao(row: ExtratoTransacaoRow): ExtratoTransacaoItem {
  return {
    id: row.id,
    contaId: row.conta_id,
    fitid: row.fitid,
    data: row.data,
    valorCentavos: row.valor_centavos,
    memo: row.memo,
    tipoOfx: row.tipo_ofx,
    status: row.status,
    lancamentoId: row.lancamento_id,
  };
}

interface RegraRow {
  id: string;
  padrao: string;
  categoria_id: string | null;
  cliente_id: string | null;
  fornecedor_id: string | null;
  ativo: boolean;
}

const REGRA_COLS = "id,padrao,categoria_id,cliente_id,fornecedor_id,ativo" as const;

function mapRegra(row: RegraRow): RegraClassificacao {
  return {
    id: row.id,
    padrao: row.padrao,
    categoriaId: row.categoria_id,
    clienteId: row.cliente_id,
    fornecedorId: row.fornecedor_id,
    ativo: row.ativo,
  };
}

interface ContratoRow {
  id: string;
  cliente_id: string;
  descricao: string | null;
  valor_mensal_centavos: number;
  dia_vencimento: number;
  inicio: string;
  fim: string | null;
  status: ContratoStatus;
  bloqueia_os_em_atraso: boolean;
}

const CONTRATO_COLS =
  "id,cliente_id,descricao,valor_mensal_centavos,dia_vencimento,inicio,fim,status,bloqueia_os_em_atraso" as const;

interface ReguaPontoRow {
  id: string;
  dia_offset: number;
  canal: CanalCobranca;
  mensagem_modelo: string;
  ativo: boolean;
}

const REGUA_PONTO_COLS = "id,dia_offset,canal,mensagem_modelo,ativo" as const;

function mapReguaPonto(row: ReguaPontoRow): PontoReguaItem {
  return {
    id: row.id,
    diaOffset: row.dia_offset,
    canal: row.canal,
    mensagemModelo: row.mensagem_modelo,
    ativo: row.ativo,
  };
}

interface ReguaEnvioRow {
  id: string;
  lancamento_id: string;
  ponto_id: string;
  canal_efetivo: CanalCobranca | null;
  status: "enviado" | "erro" | "sem_canal";
  motivo: string | null;
  enviado_em: string;
}

const REGUA_ENVIO_COLS =
  "id,lancamento_id,ponto_id,canal_efetivo,status,motivo,enviado_em" as const;

function mapReguaEnvio(row: ReguaEnvioRow): EnvioReguaItem {
  return {
    id: row.id,
    lancamentoId: row.lancamento_id,
    pontoId: row.ponto_id,
    canalEfetivo: row.canal_efetivo,
    status: row.status,
    motivo: row.motivo,
    enviadoEm: row.enviado_em,
  };
}

interface CobrancaRow {
  id: string;
  lancamento_id: string;
  tipo: CobrancaTipo;
  status: CobrancaItem["status"];
  external_id: string;
  linha_digitavel: string | null;
  qr_code: string | null;
  qr_code_base64: string | null;
  link_pagamento: string | null;
  valor_centavos: number;
  criado_em: string;
  atualizado_em: string;
}

const COBRANCA_COLS =
  "id,lancamento_id,tipo,status,external_id,linha_digitavel,qr_code,qr_code_base64,link_pagamento,valor_centavos,criado_em,atualizado_em" as const;

function mapCobranca(row: CobrancaRow): CobrancaItem {
  return {
    id: row.id,
    lancamentoId: row.lancamento_id,
    tipo: row.tipo,
    status: row.status,
    externalId: row.external_id,
    linhaDigitavel: row.linha_digitavel,
    qrCode: row.qr_code,
    qrCodeBase64: row.qr_code_base64,
    linkPagamento: row.link_pagamento,
    valorCentavos: row.valor_centavos,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

interface ConfigImpostosRow {
  tipo: ConfigImpostos["tipo"];
  aliquota_fixa: number | null;
  faixas: ConfigImpostos["faixas"];
  dia_vencimento: number;
}

const CONFIG_IMPOSTOS_COLS = "tipo,aliquota_fixa,faixas,dia_vencimento" as const;

function mapConfigImpostos(row: ConfigImpostosRow): ConfigImpostos {
  return {
    tipo: row.tipo,
    aliquotaFixa: row.aliquota_fixa,
    faixas: row.faixas ?? [],
    diaVencimento: row.dia_vencimento,
  };
}

interface ProvisaoImpostoRow {
  competencia: string;
  receita_centavos: number;
  rbt12_centavos: number;
  aliquota_efetiva: number;
  valor_centavos: number;
  lancamento_id: string | null;
}

function mapProvisaoImposto(row: ProvisaoImpostoRow): ProvisaoImposto {
  return {
    competencia: row.competencia,
    receitaCentavos: row.receita_centavos,
    rbt12Centavos: row.rbt12_centavos,
    aliquotaEfetiva: row.aliquota_efetiva,
    valorCentavos: row.valor_centavos,
    lancamentoId: row.lancamento_id,
  };
}

interface FechamentoRow {
  competencia: string;
  status: FechamentoMensal["status"];
  updated_at: string;
  updated_by: string | null;
}

function mapFechamento(row: FechamentoRow): FechamentoMensal {
  return {
    competencia: row.competencia,
    status: row.status,
    fechadoEm: row.updated_at,
    fechadoPor: row.updated_by,
  };
}

function mapContrato(row: ContratoRow): ContratoItem {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    descricao: row.descricao,
    valorMensalCentavos: row.valor_mensal_centavos,
    diaVencimento: row.dia_vencimento,
    inicio: row.inicio,
    fim: row.fim,
    status: row.status,
    bloqueiaOsEmAtraso: row.bloqueia_os_em_atraso,
  };
}
