import type {
  CriarInspecaoInput,
  CriarInspecaoItemInput,
  CriarLaudoSpdaInput,
  CriarPontoSpdaInput,
  QualidadeGateway,
} from "./qualidade-gateway";

function exigirTexto(valor: string, campo: string): string {
  const normalizado = valor.trim();
  if (normalizado.length === 0) throw new Error(`${campo} é obrigatório.`);
  return normalizado;
}

export async function carregarDadosQualidade(gateway: QualidadeGateway) {
  const [clientes, inspecoes, laudos] = await Promise.all([
    gateway.listarClientes(),
    gateway.listarInspecoes(),
    gateway.listarLaudosSpda(),
  ]);
  return { clientes, inspecoes, laudos };
}

export async function criarInspecao(gateway: QualidadeGateway, input: CriarInspecaoInput) {
  return gateway.criarInspecao({
    ...input,
    titulo: exigirTexto(input.titulo, "Título"),
    responsavelTecnico: input.responsavelTecnico?.trim() || null,
    observacoesGerais: input.observacoesGerais?.trim() || null,
  });
}

export async function criarItemInspecao(gateway: QualidadeGateway, input: CriarInspecaoItemInput) {
  return gateway.criarItemInspecao({
    ...input,
    descricao: exigirTexto(input.descricao, "Descrição do item"),
    localizacao: input.localizacao?.trim() || null,
    recomendacao: input.recomendacao?.trim() || null,
    fotoUrl: input.fotoUrl?.trim() || null,
  });
}

export async function criarLaudoSpda(gateway: QualidadeGateway, input: CriarLaudoSpdaInput) {
  return gateway.criarLaudoSpda({
    ...input,
    arteNumero: input.arteNumero?.trim() || null,
    responsavelTecnico: input.responsavelTecnico?.trim() || null,
    notasGerais: input.notasGerais?.trim() || null,
  });
}

export async function criarPontoSpda(gateway: QualidadeGateway, input: CriarPontoSpdaInput) {
  return gateway.criarPontoSpda({
    ...input,
    localizacao: exigirTexto(input.localizacao, "Localização"),
    observacoes: input.observacoes?.trim() || null,
    fotoUrl: input.fotoUrl?.trim() || null,
  });
}
