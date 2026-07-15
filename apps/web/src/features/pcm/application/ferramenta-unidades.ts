import {
  validarAtribuicaoUnidade,
  validarBaixaUnidade,
  validarDevolucaoUnidade,
} from "../domain/ferramenta-unidades";
import type {
  AtribuirUnidadeCommand,
  BaixarUnidadeCommand,
  DevolverUnidadeCommand,
  FerramentaUnidadesGateway,
  GerarUnidadesCommand,
} from "./ferramenta-unidades-gateway";

export function listarUnidadesFerramenta(gateway: FerramentaUnidadesGateway) {
  return gateway.listarUnidades();
}

export function listarHistoricoUnidade(gateway: FerramentaUnidadesGateway, unidadeId: string) {
  return gateway.listarHistoricoUnidade(unidadeId);
}

export function listarHistoricoFuncionario(
  gateway: FerramentaUnidadesGateway,
  funcionarioId: string,
) {
  return gateway.listarHistoricoFuncionario(funcionarioId);
}

export function gerarUnidadesFerramenta(
  gateway: FerramentaUnidadesGateway,
  input: GerarUnidadesCommand,
) {
  if (input.quantidade <= 0) throw new Error("Quantidade a gerar deve ser maior que zero.");
  return gateway.gerarUnidades(input);
}

export async function atribuirUnidadeFerramenta(
  gateway: FerramentaUnidadesGateway,
  input: AtribuirUnidadeCommand,
) {
  const unidades = await gateway.listarUnidades();
  const unidade = unidades.find((item) => item.id === input.unidadeId);
  validarAtribuicaoUnidade(input, unidade);
  await gateway.atribuir(input);
}

export async function devolverUnidadeFerramenta(
  gateway: FerramentaUnidadesGateway,
  input: DevolverUnidadeCommand,
) {
  const unidades = await gateway.listarUnidades();
  const unidade = unidades.find((item) => item.id === input.unidadeId);
  const validado = validarDevolucaoUnidade(input, unidade);
  await gateway.devolver({ ...validado, userId: input.userId });
}

export async function baixarUnidadeFerramenta(
  gateway: FerramentaUnidadesGateway,
  input: BaixarUnidadeCommand,
) {
  const unidades = await gateway.listarUnidades();
  const unidade = unidades.find((item) => item.id === input.unidadeId);
  const validado = validarBaixaUnidade(input, unidade);
  await gateway.baixar({ ...validado, userId: input.userId });
}
