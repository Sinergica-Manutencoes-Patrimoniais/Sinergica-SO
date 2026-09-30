import { validarEquipamento, validarParentItem } from "../domain/equipamentos";
import type {
  AtualizarPosicaoComponenteCommand,
  DesativarEquipamentoCommand,
  EditarEquipamentoCommand,
  EquipamentoCommand,
  EquipamentosGateway,
} from "./equipamentos-gateway";
import { IdentificadorDuplicadoError, resolverIdentificadorNaCriacao } from "./identificador-ativo";
import type { IdentificadorAtivoGateway, NivelComSigla } from "./identificador-ativo-gateway";

export interface CriarComIdentificadorOpcoes {
  identificador: IdentificadorAtivoGateway;
  siglasInformadas: Array<{ nivel: NivelComSigla; id: string; sigla: string }>;
  identificadorManual: string | null;
}

export function listarEquipamentos(gateway: EquipamentosGateway) {
  return gateway.listar();
}

export function listarClientesEquipamento(gateway: EquipamentosGateway) {
  return gateway.listarClientes();
}

export async function criarEquipamento(
  gateway: EquipamentosGateway,
  input: EquipamentoCommand,
  opcoesIdentificador?: CriarComIdentificadorOpcoes,
) {
  const validado = validarEquipamento(input);
  if (validado.parentItemId) {
    const pai = await gateway.obterItem(validado.parentItemId);
    validarParentItem(validado.clientId ?? null, pai);
  }
  if (!opcoesIdentificador) return gateway.criar({ ...validado, userId: input.userId });

  const resolver = () =>
    resolverIdentificadorNaCriacao(
      opcoesIdentificador.identificador,
      {
        clienteId: validado.clientId as string,
        areaId: validado.areaId ?? null,
        localId: validado.localId ?? null,
        categoriaId: validado.categoriaId as string,
        nomeAtivo: validado.nome,
      },
      { ...opcoesIdentificador, userId: input.userId },
    );
  const primeiro = await resolver();
  try {
    return await gateway.criar({
      ...validado,
      identificador: primeiro.identificador,
      userId: input.userId,
    });
  } catch (erro) {
    if (!(erro instanceof IdentificadorDuplicadoError)) throw erro;
    if (!primeiro.nnDoSequencial) {
      throw new Error(
        `O identificador ${primeiro.identificador} já existe. Mude o número no nome ou edite o identificador.`,
      );
    }
    const segundo = await resolver();
    try {
      return await gateway.criar({
        ...validado,
        identificador: segundo.identificador,
        userId: input.userId,
      });
    } catch (segundoErro) {
      if (segundoErro instanceof IdentificadorDuplicadoError) {
        throw new Error("Não foi possível reservar o identificador. Tente salvar de novo.");
      }
      throw segundoErro;
    }
  }
}

export async function editarEquipamento(
  gateway: EquipamentosGateway,
  input: EditarEquipamentoCommand,
) {
  const validado = validarEquipamento(input);
  if (validado.parentItemId) {
    const pai = await gateway.obterItem(validado.parentItemId);
    validarParentItem(validado.clientId ?? null, pai);
  }
  return gateway.editar({ ...validado, id: input.id, userId: input.userId });
}

/** AC-6 — resolve o caminho de instalação (Cliente>Área>Local) + Sistemas do Item, pra tela de
 * Detalhe do Item (breadcrumb + chips). */
export function obterContextoItem(gateway: EquipamentosGateway, id: string) {
  return gateway.obterContextoItem(id);
}

export function desativarEquipamento(
  gateway: EquipamentosGateway,
  input: DesativarEquipamentoCommand,
) {
  if (!input.id) throw new Error("Componente é obrigatório.");
  return gateway.desativar(input);
}

/** E01-S155: move o Componente pelo Board/painel da 360 — de propósito **sem** `validarEquipamento`
 * (cliente/categoria obrigatórios): mover um item legado incompleto não pode travar. */
export async function atualizarPosicaoComponente(
  gateway: EquipamentosGateway,
  input: AtualizarPosicaoComponenteCommand,
) {
  if (!input.id) throw new Error("Componente é obrigatório.");
  return gateway.atualizarPosicao(input);
}
