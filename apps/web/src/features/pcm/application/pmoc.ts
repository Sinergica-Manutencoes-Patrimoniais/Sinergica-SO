import { classificarMicrobio, validarTransicaoStatusNc } from "../domain/pmoc";
import type { PmocStatusNc, PmocTipoManutencao } from "../domain/pmoc";
import { TIPO_MANUTENCAO_LABEL } from "../domain/pmoc";
import { abrirOrdemServico } from "./abrir-ordem-servico";
import type { OrdemServicoCriada, OrdemServicoGateway } from "./ordem-servico-gateway";
import type {
  AtualizarStatusNcInput,
  CriarAnaliseMicrobioInput,
  CriarContratoPmocInput,
  CriarEquipamentoPmocInput,
  CriarNaoConformidadeInput,
  PmocGateway,
  PmocPreventivaResumo,
} from "./pmoc-gateway";

function exigirTexto(valor: string, campo: string): string {
  const normalizado = valor.trim();
  if (!normalizado) throw new Error(`${campo} é obrigatório.`);
  return normalizado;
}

function normalizarOpcional(valor: string | null): string | null {
  return valor?.trim() || null;
}

function validarPeriodo(startDate: string, endDate: string) {
  const inicio = new Date(`${startDate}T00:00:00`);
  const fim = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(inicio.getTime())) throw new Error("Data de início inválida.");
  if (Number.isNaN(fim.getTime())) throw new Error("Data de término inválida.");
  if (fim < inicio) throw new Error("Data de término deve ser posterior ao início.");
}

export async function carregarPmoc(gateway: PmocGateway) {
  const [clientes, contratos] = await Promise.all([
    gateway.listarClientes(),
    gateway.listarContratos(),
  ]);
  return { clientes, contratos };
}

/** E01-S84 AC-3: alimenta a coluna "Preventiva" do Kanban de OS. */
export async function listarProximasPreventivas(
  gateway: PmocGateway,
): Promise<PmocPreventivaResumo[]> {
  return gateway.listarProximasPreventivas();
}

export async function criarContratoPmoc(gateway: PmocGateway, input: CriarContratoPmocInput) {
  if (!input.clientId) throw new Error("Cliente é obrigatório.");
  validarPeriodo(input.startDate, input.endDate);

  return gateway.criarContrato({
    ...input,
    imovelNome: exigirTexto(input.imovelNome, "Nome do imóvel"),
    endereco: normalizarOpcional(input.endereco),
    cidade: normalizarOpcional(input.cidade),
    estado: normalizarOpcional(input.estado),
    cep: normalizarOpcional(input.cep),
    cnpjCpf: normalizarOpcional(input.cnpjCpf),
    contatoNome: normalizarOpcional(input.contatoNome),
    contatoCargo: normalizarOpcional(input.contatoCargo),
    contatoTelefone: normalizarOpcional(input.contatoTelefone),
    contatoEmail: normalizarOpcional(input.contatoEmail),
    tecnicoNome: exigirTexto(input.tecnicoNome || "Fabrício Medeiros", "Responsável técnico"),
    crea: normalizarOpcional(input.crea),
    artNumber: normalizarOpcional(input.artNumber),
    artDate: normalizarOpcional(input.artDate),
    notes: normalizarOpcional(input.notes),
    equipamentos: input.equipamentos
      .filter((equipamento) => equipamento.tag.trim())
      .map((equipamento) => ({
        ...equipamento,
        tag: equipamento.tag.trim().toUpperCase(),
        location: normalizarOpcional(equipamento.location),
      })),
  });
}

export async function criarEquipamentoPmoc(gateway: PmocGateway, input: CriarEquipamentoPmocInput) {
  if (!input.propertyId) throw new Error("Imóvel PMOC é obrigatório.");

  return gateway.criarEquipamento({
    ...input,
    tag: exigirTexto(input.tag, "Tag").toUpperCase(),
    brand: normalizarOpcional(input.brand),
    model: normalizarOpcional(input.model),
    location: normalizarOpcional(input.location),
    environment: normalizarOpcional(input.environment),
    floor: normalizarOpcional(input.floor),
    refrigerant: exigirTexto(input.refrigerant || "R-410A", "Fluido refrigerante"),
    notes: normalizarOpcional(input.notes),
  });
}

/** Input do caller (sem status/correctiveActionNeeded — são calculados aqui, AC-1). */
type RegistrarAnaliseMicrobioInput = Omit<
  CriarAnaliseMicrobioInput,
  "status" | "correctiveActionNeeded"
>;

export async function registrarAnaliseMicrobio(
  gateway: PmocGateway,
  input: RegistrarAnaliseMicrobioInput,
) {
  if (!input.contractId) throw new Error("Contrato é obrigatório.");
  const status = classificarMicrobio({
    fungiUfcM3: input.fungiUfcM3,
    ieRatio: input.ieRatio,
    coliformsResult: input.coliformsResult,
  });

  return gateway.criarAnaliseMicrobio({
    ...input,
    labName: normalizarOpcional(input.labName),
    labAccreditation: normalizarOpcional(input.labAccreditation),
    reportNumber: normalizarOpcional(input.reportNumber),
    reportUrl: normalizarOpcional(input.reportUrl),
    notes: normalizarOpcional(input.notes),
    status,
    // AC-1: só marca ação corretiva quando efetivamente não-conforme (pendente/conforme não marcam).
    correctiveActionNeeded: status === "nao_conforme",
  });
}

export async function registrarNaoConformidade(
  gateway: PmocGateway,
  input: CriarNaoConformidadeInput,
) {
  if (!input.contractId) throw new Error("Contrato é obrigatório.");
  return gateway.criarNaoConformidade({
    ...input,
    description: exigirTexto(input.description, "Descrição"),
    tag: normalizarOpcional(input.tag),
    recommendedAction: normalizarOpcional(input.recommendedAction),
    responsible: normalizarOpcional(input.responsible),
    deadline: normalizarOpcional(input.deadline),
  });
}

/** AC-6: valida a transição antes de persistir; ao fechar, preenche `completedAt` com hoje se
 * o caller não informou. */
export async function avancarStatusNc(
  gateway: PmocGateway,
  atual: PmocStatusNc,
  input: AtualizarStatusNcInput,
) {
  validarTransicaoStatusNc(atual, input.status);
  const completedAt =
    input.status === "fechado"
      ? (input.completedAt ?? new Date().toISOString().slice(0, 10))
      : null;
  return gateway.atualizarStatusNc({ ...input, completedAt });
}

export interface CriarOsDaVisitaInput {
  clientId: string;
  imovelNome: string;
  endereco: string | null;
  scheduleId: string;
  maintenanceType: PmocTipoManutencao;
  scheduledDate: string;
  tecnicoId: string | null;
  tipoTarefaId: string;
  createdBy: string;
}

/** E01-S05 AC-1: cria a OS de uma visita agendada, síncrona (reusa `abrirOrdemServico` — mesmo
 * pipeline que já cria a tarefa no Auvo, em produção desde E01-S09). `categoria='preventiva'` +
 * `pmocScheduleId` fazem `inferirTipoOsHub` (E01-S07) classificar como P1 automaticamente. */
export async function criarOsDaVisitaPmoc(
  gatewayOs: OrdemServicoGateway,
  input: CriarOsDaVisitaInput,
): Promise<OrdemServicoCriada> {
  return abrirOrdemServico(gatewayOs, {
    clientId: input.clientId,
    titulo: `Visita PMOC (${TIPO_MANUTENCAO_LABEL[input.maintenanceType]}) — ${input.imovelNome}`,
    descricao: null,
    categoria: "preventiva",
    prioridade: "normal",
    // GUT não é como o PMOC prioriza (a prioridade real vem do Hub — E01-S07 AC-2, via tipoOs +
    // data_agendada); valores neutros só pra satisfazer o schema legado de backlog GUT.
    gravidade: 2,
    urgencia: 2,
    tendencia: 2,
    dorCliente: null,
    observacao: null,
    localDescricao: input.endereco,
    solicitante: null,
    origem: "pmoc",
    tecnicoId: input.tecnicoId,
    tipoTarefaId: input.tipoTarefaId,
    dataPrevista: input.scheduledDate,
    createdBy: input.createdBy,
    pmocScheduleId: input.scheduleId,
  });
}
