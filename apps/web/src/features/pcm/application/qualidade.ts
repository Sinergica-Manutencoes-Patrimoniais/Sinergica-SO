import {
  validarCabecalhoInspecao,
  validarChecklistTemplate,
  validarItemInspecao,
  validarTipoInspecao,
} from "../domain/inspecoes-laudos";
import type {
  CriarChecklistTemplateInput,
  CriarInspecaoInput,
  CriarInspecaoItemInput,
  CriarLaudoSpdaInput,
  CriarPontoSpdaInput,
  CriarTipoInspecaoInput,
  EditarInspecaoInput,
  EditarInspecaoItemInput,
  EditarTipoInspecaoInput,
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
  if (!input.clientId) throw new Error("Cliente é obrigatório.");
  const cabecalho = validarCabecalhoInspecao({
    titulo: input.titulo,
    tipoInspecaoId: input.tipoInspecaoId ?? null,
    dataInspecao: input.dataInspecao,
    horaInicio: input.horaInicio ?? null,
    horaFim: input.horaFim ?? null,
    edificacao: input.edificacao ?? null,
    endereco: input.endereco ?? null,
    inspetor: input.inspetor ?? null,
    responsavelNoLocal: input.responsavelNoLocal ?? null,
    responsavelTecnico: input.responsavelTecnico,
    escopo: input.escopo ?? null,
    normaTecnica: input.normaTecnica ?? null,
    art: input.art ?? null,
    condicoes: input.condicoes ?? null,
    observacoesGerais: input.observacoesGerais,
  });
  return gateway.criarInspecao({ ...input, ...cabecalho });
}

export async function editarInspecao(gateway: QualidadeGateway, input: EditarInspecaoInput) {
  if (!input.id) throw new Error("Inspeção é obrigatória.");
  if (!input.clientId) throw new Error("Cliente é obrigatório.");
  const cabecalho = validarCabecalhoInspecao({
    titulo: input.titulo,
    tipoInspecaoId: input.tipoInspecaoId ?? null,
    dataInspecao: input.dataInspecao,
    horaInicio: input.horaInicio ?? null,
    horaFim: input.horaFim ?? null,
    edificacao: input.edificacao ?? null,
    endereco: input.endereco ?? null,
    inspetor: input.inspetor ?? null,
    responsavelNoLocal: input.responsavelNoLocal ?? null,
    responsavelTecnico: input.responsavelTecnico,
    escopo: input.escopo ?? null,
    normaTecnica: input.normaTecnica ?? null,
    art: input.art ?? null,
    condicoes: input.condicoes ?? null,
    observacoesGerais: input.observacoesGerais,
  });
  return gateway.editarInspecao({ ...input, ...cabecalho });
}

export async function criarItemInspecao(gateway: QualidadeGateway, input: CriarInspecaoItemInput) {
  const item = validarItemInspecao({
    sistema: input.sistema,
    categoria: input.categoria ?? null,
    elemento: input.elemento ?? null,
    localizacao: input.localizacao,
    identificacao: input.identificacao ?? null,
    descricao: input.descricao,
    resultado: input.resultado,
    grauRisco: input.grauRisco ?? null,
    estadoConservacao: input.estadoConservacao ?? null,
    anomalia: input.anomalia ?? null,
    recomendacao: input.recomendacao,
    prazoRecomendado: input.prazoRecomendado,
    responsavelAcao: input.responsavelAcao ?? null,
    observacoes: input.observacoes ?? null,
  });
  return gateway.criarItemInspecao({ ...input, ...item, fotoUrl: input.fotoUrl?.trim() || null });
}

export async function editarItemInspecao(
  gateway: QualidadeGateway,
  input: EditarInspecaoItemInput,
) {
  if (!input.id) throw new Error("Item é obrigatório.");
  const item = validarItemInspecao({
    sistema: input.sistema,
    categoria: input.categoria ?? null,
    elemento: input.elemento ?? null,
    localizacao: input.localizacao,
    identificacao: input.identificacao ?? null,
    descricao: input.descricao,
    resultado: input.resultado,
    grauRisco: input.grauRisco ?? null,
    estadoConservacao: input.estadoConservacao ?? null,
    anomalia: input.anomalia ?? null,
    recomendacao: input.recomendacao,
    prazoRecomendado: input.prazoRecomendado,
    responsavelAcao: input.responsavelAcao ?? null,
    observacoes: input.observacoes ?? null,
  });
  return gateway.editarItemInspecao({ ...input, ...item, fotoUrl: input.fotoUrl?.trim() || null });
}

export async function excluirItemInspecao(gateway: QualidadeGateway, id: string) {
  if (!id) throw new Error("Item é obrigatório.");
  return gateway.excluirItemInspecao(id);
}

export async function criarLaudoSpda(gateway: QualidadeGateway, input: CriarLaudoSpdaInput) {
  if (!input.clientId) throw new Error("Cliente é obrigatório.");
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

// ── E01-S73: parametrização ──────────────────────────────────────────────────────────────────

export async function carregarParametrizacaoInspecao(gateway: QualidadeGateway) {
  const [tipos, templates] = await Promise.all([
    gateway.listarTiposInspecao(),
    gateway.listarTemplates(),
  ]);
  return { tipos, templates };
}

export async function criarTipoInspecao(gateway: QualidadeGateway, input: CriarTipoInspecaoInput) {
  const validado = validarTipoInspecao(input);
  return gateway.criarTipoInspecao({ ...input, ...validado });
}

export async function editarTipoInspecao(
  gateway: QualidadeGateway,
  input: EditarTipoInspecaoInput,
) {
  if (!input.id) throw new Error("Tipo de inspeção é obrigatório.");
  const validado = validarTipoInspecao(input);
  return gateway.editarTipoInspecao({ ...input, ...validado });
}

export async function criarTemplate(gateway: QualidadeGateway, input: CriarChecklistTemplateInput) {
  const validado = validarChecklistTemplate({
    tipoInspecaoId: input.tipoInspecaoId,
    nome: input.nome,
    itens: input.itens,
  });
  return gateway.criarTemplate({ ...input, nome: validado.nome, itens: validado.itens });
}

export async function aplicarTemplate(
  gateway: QualidadeGateway,
  inspecaoId: string,
  templateId: string,
  userId: string,
) {
  if (!inspecaoId) throw new Error("Inspeção é obrigatória.");
  if (!templateId) throw new Error("Template é obrigatório.");
  return gateway.aplicarTemplate(inspecaoId, templateId, userId);
}
