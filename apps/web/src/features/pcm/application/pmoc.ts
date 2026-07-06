import type {
  CriarContratoPmocInput,
  CriarEquipamentoPmocInput,
  PmocGateway,
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
