import { validarAlocacao, validarFerramenta } from "../domain/ferramentas";
import type {
  AlocarFerramentaCommand,
  DesativarFerramentaCommand,
  EditarFerramentaCommand,
  FerramentaAlocacoesGateway,
  FerramentaCommand,
  FerramentasGateway,
} from "./ferramentas-gateway";

export function listarFerramentas(gateway: FerramentasGateway) {
  return gateway.listar();
}

export function listarCategoriasFerramenta(gateway: FerramentasGateway) {
  return gateway.listarCategorias();
}

export function criarFerramenta(gateway: FerramentasGateway, input: FerramentaCommand) {
  const validado = validarFerramenta(input);
  return gateway.criar({ ...validado, userId: input.userId });
}

export function editarFerramenta(gateway: FerramentasGateway, input: EditarFerramentaCommand) {
  const validado = validarFerramenta(input);
  return gateway.editar({ ...validado, id: input.id, userId: input.userId });
}

export function desativarFerramenta(
  gateway: FerramentasGateway,
  input: DesativarFerramentaCommand,
) {
  if (!input.id) throw new Error("Ferramenta é obrigatória.");
  return gateway.desativar(input);
}

export async function obterFerramentasPorTecnico(gateway: FerramentaAlocacoesGateway) {
  const [ferramentas, funcionarios, alocacoes] = await Promise.all([
    gateway.listarFerramentas(),
    gateway.listarFuncionarios(),
    gateway.listarAlocacoes(),
  ]);
  return { ferramentas, funcionarios, alocacoes };
}

export async function alocarFerramenta(
  gateway: FerramentaAlocacoesGateway,
  input: AlocarFerramentaCommand,
) {
  const dados = await obterFerramentasPorTecnico(gateway);
  const ferramenta = dados.ferramentas.find((item) => item.id === input.ferramentaId);
  const funcionario = dados.funcionarios.find((item) => item.id === input.funcionarioId);
  validarAlocacao(input, ferramenta, funcionario);
  await gateway.alocar(input);
}
