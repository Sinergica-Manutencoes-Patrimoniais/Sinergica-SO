import type { RecebivelAging } from "../domain/aging";
import type { PagavelAging } from "../domain/aging-pagaveis";
import type { CategoriaFormData, CategoriaItem } from "../domain/categoria";
import type { CobrancaItem, CobrancaTipo } from "../domain/cobranca";
import type {
  ExtratoTransacaoItem,
  LancamentoPrevistoCandidato,
  RegraClassificacao,
} from "../domain/conciliacao";
import type { ContaBancariaFormData, ContaBancariaItem } from "../domain/conta-bancaria";
import type { ContratoFormData, ContratoItem } from "../domain/contrato";
import type { GastoCategoria, PontoFluxoMensal, ResumoCaixa } from "../domain/dashboard";
import type { LinhaDre, OrcamentoRealizadoLinha } from "../domain/dre";
import type { FechamentoMensal } from "../domain/fechamento";
import type { ConfigImpostos, ProvisaoImposto } from "../domain/impostos";
import type { LancamentoFormData, LancamentoItem } from "../domain/lancamento";
import type { TransacaoOfx } from "../domain/ofx";
import type { PontoProjecaoCaixa } from "../domain/projecao-caixa";
import type { RecorrenciaFormData, RecorrenciaItem } from "../domain/recorrencia-pagavel";
import type { EnvioReguaItem, PontoReguaFormData, PontoReguaItem } from "../domain/regua-cobranca";
import type {
  CustoFuncionarioFormData,
  CustoFuncionarioItem,
  RentabilidadeMes,
} from "../domain/rentabilidade";
import type { TransferenciaFormData } from "../domain/transferencia";

export interface FuncionarioOpcao {
  id: string;
  nome: string;
}

export interface CustoOsItem {
  osId: string;
  numero: string;
  data: string;
  tecnicoFuncionarioId: string | null;
  horas: number;
  custoHoraReais: number | null;
  custoMoCentavos: number;
  despesaCentavos: number;
  valorado: boolean;
}

export interface CategoriaCommand extends CategoriaFormData {
  userId: string;
}
export interface EditarCategoriaCommand extends CategoriaCommand {
  id: string;
}
export interface DesativarCategoriaCommand {
  id: string;
  userId: string;
}

export interface ContaBancariaCommand extends ContaBancariaFormData {
  userId: string;
}
export interface EditarContaBancariaCommand extends ContaBancariaCommand {
  id: string;
}
export interface DesativarContaBancariaCommand {
  id: string;
  userId: string;
}

export interface LancamentoCommand extends LancamentoFormData {
  userId: string;
}
export interface EditarLancamentoCommand extends LancamentoCommand {
  id: string;
}
export interface BaixarLancamentoCommand {
  id: string;
  dataPagamento: string;
  userId: string;
}
export interface EstornarBaixaLancamentoCommand {
  id: string;
  userId: string;
}

export interface FiltroLancamentos {
  competenciaInicio?: string;
  competenciaFim?: string;
  tipo?: "entrada" | "saida";
  status?: "previsto" | "realizado";
  categoriaId?: string;
  contaId?: string;
  clienteId?: string;
}

export interface ClienteOpcao {
  id: string;
  nome: string;
}

export interface FinanceiroGateway {
  /** Financeiro lê pcm.clientes read-only (relação Conformist, domain.md do épico) — só pra
   * popular o seletor de cliente do lançamento, nunca escreve em `pcm.*`. */
  listarClientesOpcoes(): Promise<ClienteOpcao[]>;

  listarCategorias(): Promise<CategoriaItem[]>;
  criarCategoria(input: CategoriaCommand): Promise<CategoriaItem>;
  editarCategoria(input: EditarCategoriaCommand): Promise<CategoriaItem>;
  desativarCategoria(input: DesativarCategoriaCommand): Promise<void>;

  listarContas(): Promise<ContaBancariaItem[]>;
  criarConta(input: ContaBancariaCommand): Promise<ContaBancariaItem>;
  editarConta(input: EditarContaBancariaCommand): Promise<ContaBancariaItem>;
  desativarConta(input: DesativarContaBancariaCommand): Promise<void>;

  listarLancamentos(filtro?: FiltroLancamentos): Promise<LancamentoItem[]>;
  criarLancamento(input: LancamentoCommand): Promise<LancamentoItem>;
  editarLancamento(input: EditarLancamentoCommand): Promise<LancamentoItem>;
  baixarLancamento(input: BaixarLancamentoCommand): Promise<LancamentoItem>;
  estornarBaixaLancamento(input: EstornarBaixaLancamentoCommand): Promise<LancamentoItem>;

  obterResumoCaixa(): Promise<ResumoCaixa>;
  obterFluxoMensal(meses: number): Promise<PontoFluxoMensal[]>;
  obterGastosCategoria(inicio: string, fim: string): Promise<GastoCategoria[]>;

  listarContratos(): Promise<ContratoItem[]>;
  criarContrato(input: ContratoCommand): Promise<ContratoItem>;
  editarContrato(input: EditarContratoCommand): Promise<ContratoItem>;
  gerarRecorrencias(competencia: string): Promise<number>;
  listarAgingRecebiveis(): Promise<RecebivelAging[]>;

  /** Importa transações (dedupe por conta+fitid no banco) — devolve quantas entraram de fato. */
  importarExtrato(
    contaId: string,
    transacoes: TransacaoOfx[],
  ): Promise<{ novas: number; duplicadas: number }>;
  listarTransacoesPendentes(contaId?: string): Promise<ExtratoTransacaoItem[]>;
  listarRegrasClassificacao(): Promise<RegraClassificacao[]>;
  criarRegraClassificacao(input: RegraClassificacaoCommand): Promise<RegraClassificacao>;
  listarLancamentosPrevistosPorConta(contaId: string): Promise<LancamentoPrevistoCandidato[]>;
  conciliarTransacao(input: ConciliarTransacaoCommand): Promise<void>;
  desfazerConciliacao(transacaoId: string, userId: string): Promise<void>;
  criarLancamentoDeTransacao(input: CriarLancamentoDeTransacaoCommand): Promise<LancamentoItem>;
  ignorarTransacao(transacaoId: string): Promise<void>;
  reverterIgnorarTransacao(transacaoId: string): Promise<void>;

  listarRecorrencias(): Promise<RecorrenciaItem[]>;
  criarRecorrencia(input: RecorrenciaCommand): Promise<RecorrenciaItem>;
  editarRecorrencia(input: EditarRecorrenciaCommand): Promise<RecorrenciaItem>;
  desativarRecorrencia(id: string, userId: string): Promise<void>;
  listarAgingPagaveis(): Promise<PagavelAging[]>;
  obterProjecaoCaixa(horizonteDias: number): Promise<PontoProjecaoCaixa[]>;

  /** Financeiro lê pcm.funcionarios read-only (Conformist), só pro seletor de custo. */
  listarFuncionariosOpcoes(): Promise<FuncionarioOpcao[]>;
  listarCustosFuncionario(): Promise<CustoFuncionarioItem[]>;
  criarCustoFuncionario(input: CustoFuncionarioCommand): Promise<CustoFuncionarioItem>;
  obterRentabilidadeClienteMes(meses: number): Promise<RentabilidadeMes[]>;
  obterCustoOsPorClienteMes(clienteId: string, mes: string): Promise<CustoOsItem[]>;

  /** AC-1: upload direto no bucket privado + grava o path no lançamento. */
  anexarComprovante(lancamentoId: string, arquivo: File): Promise<string>;
  urlAssinadaComprovante(path: string): Promise<string>;
  /** AC-2: edita um lançamento realizado registrando o diff em financeiro.lancamentos_eventos. */
  corrigirLancamento(input: EditarLancamentoCommand): Promise<LancamentoItem>;
  /** AC-2: exclui (estorna) um lançamento realizado não conciliado, com auditoria antes de apagar. */
  estornarLancamentoRealizado(lancamentoId: string, userId: string): Promise<void>;
  /** AC-3: transferência entre contas via RPC atômica. */
  criarTransferencia(input: TransferenciaCommand): Promise<string>;

  /** E04-S08 AC-1: régua de cobrança configurável (pontos D-x/D+x, canal, mensagem-modelo). */
  listarPontosRegua(): Promise<PontoReguaItem[]>;
  criarPontoRegua(input: PontoReguaCommand): Promise<PontoReguaItem>;
  editarPontoRegua(input: EditarPontoReguaCommand): Promise<PontoReguaItem>;
  desativarPontoRegua(id: string, userId: string): Promise<void>;
  /** AC-3: histórico de envios (auditoria/visibilidade, gravado pelo job — nunca pela UI). */
  listarEnviosRegua(lancamentoId?: string): Promise<EnvioReguaItem[]>;

  /** E04-S09 AC-2: emite boleto/PIX via Mercado Pago (Edge Function — a credencial nunca chega ao
   * client). AC-3/AC-4: status é atualizado pelo webhook/reconciliação, nunca pela UI. */
  emitirCobranca(lancamentoId: string, tipo: CobrancaTipo): Promise<CobrancaItem>;
  listarCobrancasPorLancamento(lancamentoId: string): Promise<CobrancaItem[]>;

  /** E04-S10 AC-1: config singleton (alíquota fixa ou faixas RBT12) — `null` = ainda não configurada. */
  obterConfigImpostos(): Promise<ConfigImpostos | null>;
  salvarConfigImpostos(input: ConfigImpostos & { userId: string }): Promise<ConfigImpostos>;
  /** AC-2/AC-3: calcula e provisiona (idempotente/recalcula) o imposto da competência informada. */
  provisionarImposto(competencia: string): Promise<ProvisaoImposto>;
  listarProvisoesImposto(): Promise<ProvisaoImposto[]>;

  /** E04-S11 AC-2/AC-3: fechamento mensal — trava escrita na competência (guarda no banco, RLS+trigger). */
  listarFechamentos(): Promise<FechamentoMensal[]>;
  fecharMes(competencia: string, motivo?: string | null): Promise<void>;
  reabrirMes(competencia: string, motivo: string): Promise<void>;

  /** E04-S12 AC-1/AC-4: DRE por competência — mesma fonte do dashboard de caixa (S03). */
  obterDreMensal(meses: number): Promise<LinhaDre[]>;
  /** AC-2/AC-3: orçado × realizado por categoria×mês do ano. */
  obterOrcamentoRealizado(ano: number): Promise<OrcamentoRealizadoLinha[]>;
  /** Grava o mesmo valor mensal pros 12 meses do ano (v1 simples — mês a mês fica pra evolução). */
  salvarOrcamentoAnual(
    categoriaId: string,
    ano: number,
    valorMensalCentavos: number,
    userId: string,
  ): Promise<void>;
}

export interface PontoReguaCommand extends PontoReguaFormData {
  userId: string;
}
export interface EditarPontoReguaCommand extends PontoReguaCommand {
  id: string;
}

export interface TransferenciaCommand extends TransferenciaFormData {
  userId: string;
}

export interface CustoFuncionarioCommand extends CustoFuncionarioFormData {
  userId: string;
}

export interface RecorrenciaCommand extends RecorrenciaFormData {
  userId: string;
}
export interface EditarRecorrenciaCommand extends RecorrenciaCommand {
  id: string;
}

export interface RegraClassificacaoCommand {
  padrao: string;
  categoriaId?: string | null;
  clienteId?: string | null;
  fornecedorId?: string | null;
  userId: string;
}

export interface ConciliarTransacaoCommand {
  transacaoId: string;
  lancamentoId: string;
  dataPagamento: string;
  userId: string;
}

export interface CriarLancamentoDeTransacaoCommand {
  transacaoId: string;
  categoriaId: string;
  clienteId?: string | null;
  fornecedorId?: string | null;
  descricao?: string | null;
  userId: string;
}

export interface ContratoCommand extends ContratoFormData {
  userId: string;
}
export interface EditarContratoCommand extends ContratoCommand {
  id: string;
}
