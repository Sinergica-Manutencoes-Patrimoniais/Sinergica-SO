import { diffComposicaoSistema } from "../domain/composicao-sistema";
import type { OsHistoricoItem } from "../domain/historico-ativo";
import {
  validarMembroMesmoCliente,
  validarMembroNaoDuplicado,
  validarMembroSemOutroSistema,
  validarSistema,
} from "../domain/sistemas";
import type { CriarComIdentificadorOpcoes } from "./equipamentos";
import { IdentificadorDuplicadoError, resolverIdentificadorNaCriacao } from "./identificador-ativo";
import type { EditarSistemaCommand, SistemaCommand, SistemasGateway } from "./sistemas-gateway";

export function listarSistemas(gateway: SistemasGateway, clienteId?: string) {
  return gateway.listar(clienteId);
}

export function listarMembrosSistemasDoCliente(gateway: SistemasGateway, clienteId: string) {
  return gateway.listarMembrosDoCliente(clienteId);
}

export function obterSistema(gateway: SistemasGateway, id: string) {
  return gateway.obter(id);
}

/** AC-7/AC-8 — persiste em pcm.sistemas; o trigger `trg_sistemas_auvo_enqueue` (banco) enfileira no
 * outbox automaticamente — nenhuma chamada Auvo acontece aqui (drain é assíncrono e gated por
 * `writeEnabled:false` no descriptor). */
export async function criarSistema(
  gateway: SistemasGateway,
  input: SistemaCommand,
  opcoesIdentificador?: CriarComIdentificadorOpcoes,
) {
  const validado = validarSistema(input);
  if (!opcoesIdentificador) return gateway.criar({ ...validado, userId: input.userId });
  const resolver = () =>
    resolverIdentificadorNaCriacao(
      opcoesIdentificador.identificador,
      {
        clienteId: validado.clienteId,
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
      codigo: primeiro.identificador,
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
        codigo: segundo.identificador,
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

export async function editarSistema(
  gateway: SistemasGateway,
  input: EditarSistemaCommand,
  opcoesIdentificador?: CriarComIdentificadorOpcoes,
) {
  const validado = validarSistema(input);
  if (
    !opcoesIdentificador ||
    !validado.alterarIdentificador ||
    opcoesIdentificador.identificadorManual !== null
  ) {
    return gateway.editar({ ...validado, id: input.id, userId: input.userId });
  }
  const resolvido = await resolverIdentificadorNaCriacao(
    opcoesIdentificador.identificador,
    {
      clienteId: validado.clienteId,
      areaId: validado.areaId ?? null,
      localId: validado.localId ?? null,
      categoriaId: validado.categoriaId as string,
      nomeAtivo: validado.nome,
    },
    { ...opcoesIdentificador, userId: input.userId },
  );
  return gateway.editar({
    ...validado,
    id: input.id,
    codigo: resolvido.identificador,
    alterarIdentificador: true,
    userId: input.userId,
  });
}

export async function desativarSistema(gateway: SistemasGateway, id: string, userId: string) {
  if (!id) throw new Error("Sistema é obrigatório.");
  const membros = await gateway.listarItensDoSistema(id);
  await Promise.all(membros.map((membro) => gateway.removerItem(id, membro.itemId)));
  return gateway.desativar(id, userId);
}

export function listarItensDisponiveis(gateway: SistemasGateway, clienteId: string) {
  return gateway.listarItensDisponiveis(clienteId);
}

export function listarItensDoSistema(gateway: SistemasGateway, sistemaId: string) {
  return gateway.listarItensDoSistema(sistemaId);
}

/** E01-S87 AC-2/AC-3: histórico de OS do Sistema — degrada pra `null` em falha de infra (mesmo
 * padrão de `obterDetalheAtivo`, isola a falha do resto da tela) em vez de derrubar quem chama. */
export async function listarHistoricoOsSistema(
  gateway: SistemasGateway,
  sistemaId: string,
): Promise<OsHistoricoItem[] | null> {
  try {
    return await gateway.listarHistoricoOsSistema(sistemaId);
  } catch {
    return null;
  }
}

/** AC-7 — adiciona um item ao Sistema. E01-S154 AC-4: um Componente pertence a no máximo 1
 * Sistema (`uq_sistema_itens_item_unico` no banco) — valida ANTES do round-trip pra dar erro
 * legível em vez do 23505 cru. Valida INV-5 (mesmo cliente) e INV-6 (não duplicar no mesmo
 * Sistema) também. */
export async function adicionarItem(
  gateway: SistemasGateway,
  sistemaId: string,
  itemId: string,
  userId: string,
) {
  const sistema = await gateway.obter(sistemaId);
  if (!sistema) throw new Error("Sistema não encontrado.");
  const [itens, membrosAtuais] = await Promise.all([
    gateway.listarItensDisponiveis(sistema.clienteId),
    gateway.listarItensDoSistema(sistemaId),
  ]);
  const item = itens.find((i) => i.id === itemId);
  validarMembroMesmoCliente(sistema.clienteId, item?.clientId ?? null);
  validarMembroNaoDuplicado(membrosAtuais, itemId);
  validarMembroSemOutroSistema(
    sistemaId,
    item?.sistemaId ? { sistemaId: item.sistemaId, sistemaNome: item.sistemaNome ?? "" } : null,
  );
  return gateway.adicionarItem(sistemaId, itemId, userId);
}

export function removerItem(gateway: SistemasGateway, sistemaId: string, itemId: string) {
  return gateway.removerItem(sistemaId, itemId);
}

/** E01-S86 AC-1/AC-3: persiste a composição marcada no seletor (checkbox+filtro) de uma vez —
 * calcula o diff contra os membros atuais e só chama `adicionarItem`/`removerItem` pro que
 * realmente mudou (menos round-trips que salvar item a item). */
export async function salvarComposicaoSistema(
  gateway: SistemasGateway,
  sistemaId: string,
  selecionadosIds: string[],
  userId: string,
): Promise<void> {
  const membrosAtuais = await gateway.listarItensDoSistema(sistemaId);
  const { adicionar, remover } = diffComposicaoSistema(
    membrosAtuais.map((m) => m.itemId),
    selecionadosIds,
  );
  await Promise.all([
    ...adicionar.map((itemId) => adicionarItem(gateway, sistemaId, itemId, userId)),
    ...remover.map((itemId) => gateway.removerItem(sistemaId, itemId)),
  ]);
}
