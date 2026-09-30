import type { PlanoImportacao, ResultadoPlano } from "../domain/importacao-estrutura";
import type { EstadoEstrutura } from "../domain/importacao-estrutura";
import { criarEquipamento, desativarEquipamento, editarEquipamento } from "./equipamentos";
import type { EquipamentosGateway } from "./equipamentos-gateway";
import {
  criarArea,
  criarLocal,
  desativarArea,
  desativarLocal,
  editarArea,
  editarLocal,
} from "./hierarquia";
import type { HierarquiaGateway } from "./hierarquia-gateway";
import type { IdentificadorAtivoGateway } from "./identificador-ativo-gateway";
import {
  adicionarItem,
  criarSistema,
  desativarSistema,
  editarSistema,
  removerItem,
} from "./sistemas";
import type { SistemasGateway } from "./sistemas-gateway";

export interface RelatorioImportacao {
  numero: number;
  status: "OK" | "FALHOU" | "PULADA";
  mensagem: string;
}

/** Executor propositalmente sequencial: protege outbox/drain Auvo e preserva dependências. */
export async function executarPlanoImportacao(
  plano: PlanoImportacao,
  executarLinha: (resultado: ResultadoPlano) => Promise<unknown>,
  onProgresso: (atual: number, total: number) => void,
): Promise<RelatorioImportacao[]> {
  const executaveis = plano.resultados.filter((resultado) =>
    ["CRIAR", "EDITAR", "EXCLUIR"].includes(resultado.resultado),
  );
  const falhas = new Set<number>();
  const relatorio: RelatorioImportacao[] = [];
  for (const [indice, resultado] of executaveis.entries()) {
    onProgresso(indice + 1, executaveis.length);
    if (resultado.dependeDe.some((linha) => falhas.has(linha))) {
      relatorio.push({
        numero: resultado.linha.numero,
        status: "PULADA",
        mensagem: "Depende de linha que falhou.",
      });
      continue;
    }
    try {
      await executarLinha(resultado);
      relatorio.push({ numero: resultado.linha.numero, status: "OK", mensagem: "Aplicada." });
    } catch (erro) {
      falhas.add(resultado.linha.numero);
      relatorio.push({
        numero: resultado.linha.numero,
        status: "FALHOU",
        mensagem: erro instanceof Error ? erro.message : "Falha ao aplicar linha.",
      });
    }
  }
  return relatorio;
}

export async function executarPlanoEstrutura(
  plano: PlanoImportacao,
  estado: EstadoEstrutura,
  gateways: {
    hierarquia: HierarquiaGateway;
    equipamentos: EquipamentosGateway;
    sistemas: SistemasGateway;
    identificador: IdentificadorAtivoGateway;
  },
  userId: string,
  onProgresso: (atual: number, total: number) => void,
) {
  const areaIdPorNome = new Map(estado.areas.map((area) => [normalizar(area.nome), area.id]));
  const categoriaIdPorNome = new Map(
    estado.categorias.map((categoria) => [normalizar(categoria.nome), categoria.id]),
  );
  const tipoIdPorNome = new Map(estado.tiposLocal.map((tipo) => [normalizar(tipo.nome), tipo.id]));
  const localIdPorCaminho = new Map(
    estado.locais.map((local) => [
      chaveLocal(local.areaId, caminhoLocal(local.id, estado)),
      local.id,
    ]),
  );
  const sistemaIdPorNome = new Map(
    estado.sistemas.map((sistema) => [normalizar(sistema.nome), sistema.id]),
  );
  return executarPlanoImportacao(
    plano,
    async ({ linha }) => {
      const valor =
        plano.resultados.find((resultado) => resultado.linha === linha)?.valoresExecutar ??
        linha.valores;
      const areaId = areaIdPorNome.get(normalizar(valor.Área ?? "")) ?? null;
      const categoriaId = categoriaIdPorNome.get(normalizar(valor.Categoria ?? "")) ?? null;
      if (linha.aba === "Áreas") {
        if (linha.acao === "CRIAR") {
          const criada = await criarArea(gateways.hierarquia, {
            clienteId: estado.cliente.id,
            nome: valor.Nome ?? "",
            sigla: valor.Sigla || null,
            ordem: numero(valor.Ordem),
            userId,
          });
          areaIdPorNome.set(normalizar(criada.nome), criada.id);
          return;
        }
        if (linha.acao === "EDITAR") {
          await editarArea(gateways.hierarquia, {
            id: valor.Id ?? "",
            clienteId: estado.cliente.id,
            nome: valor.Nome ?? "",
            sigla: valor.Sigla || null,
            ordem: numero(valor.Ordem),
            userId,
          });
          return;
        }
        await desativarArea(gateways.hierarquia, valor.Id ?? "", userId);
        return;
      }
      if (linha.aba === "Locais") {
        if (linha.acao !== "EXCLUIR" && !areaId)
          throw new Error(`Área «${valor.Área ?? ""}» não existe.`);
        const parentId = valor["Local pai"]
          ? (localIdPorCaminho.get(chaveLocal(areaId, valor["Local pai"])) ?? null)
          : null;
        if (valor["Local pai"] && !parentId)
          throw new Error(`Local pai «${valor["Local pai"]}» não existe.`);
        const tipoId = valor["Tipo de Local"]
          ? (tipoIdPorNome.get(normalizar(valor["Tipo de Local"])) ?? null)
          : null;
        if (linha.acao === "CRIAR") {
          if (!areaId) throw new Error(`Área «${valor.Área ?? ""}» não existe.`);
          const criado = await criarLocal(gateways.hierarquia, {
            areaId,
            parentId,
            nome: valor.Nome ?? "",
            tipoId,
            sigla: valor.Sigla || null,
            ordem: numero(valor.Ordem),
            userId,
          });
          localIdPorCaminho.set(
            chaveLocal(areaId, [valor["Local pai"], criado.nome].filter(Boolean).join(" > ")),
            criado.id,
          );
          return;
        }
        if (linha.acao === "EDITAR") {
          if (!areaId) throw new Error(`Área «${valor.Área ?? ""}» não existe.`);
          await editarLocal(gateways.hierarquia, {
            id: valor.Id ?? "",
            areaId,
            parentId,
            nome: valor.Nome ?? "",
            tipoId,
            sigla: valor.Sigla || null,
            ordem: numero(valor.Ordem),
            userId,
          });
          return;
        }
        await desativarLocal(gateways.hierarquia, valor.Id ?? "", userId);
        return;
      }
      const localId = valor.Local
        ? (localIdPorCaminho.get(chaveLocal(areaId, valor.Local)) ?? null)
        : null;
      if (valor.Local && !localId) throw new Error(`Local «${valor.Local}» não existe.`);
      if (linha.aba === "Sistemas") {
        if (linha.acao === "EXCLUIR") {
          await desativarSistema(gateways.sistemas, valor.Id ?? "", userId);
          return;
        }
        if (!categoriaId) throw new Error("Categoria é obrigatória.");
        const dados = {
          clienteId: estado.cliente.id,
          areaId,
          localId,
          nome: valor.Nome ?? "",
          categoriaId,
          categoria: valor.Categoria ?? null,
          descricao: valor.Descrição ?? null,
          userId,
        };
        if (linha.acao === "CRIAR") {
          const criado = await criarSistema(gateways.sistemas, dados, {
            identificador: gateways.identificador,
            siglasInformadas: [],
            identificadorManual: valor.Identificador || null,
          });
          sistemaIdPorNome.set(normalizar(criado.nome), criado.id);
        } else {
          await editarSistema(gateways.sistemas, { ...dados, id: valor.Id ?? "" });
        }
        return;
      }
      if (linha.acao === "EXCLUIR") {
        await desativarEquipamento(gateways.equipamentos, { id: valor.Id ?? "", userId });
        return;
      }
      if (!categoriaId) throw new Error("Categoria é obrigatória.");
      const dados = {
        clientId: estado.cliente.id,
        areaId,
        localId,
        nome: valor.Nome ?? "",
        categoriaId,
        categoria: valor.Categoria ?? null,
        observacoes: valor.Observações ?? null,
        userId,
      };
      const componente =
        linha.acao === "CRIAR"
          ? await criarEquipamento(gateways.equipamentos, dados, {
              identificador: gateways.identificador,
              siglasInformadas: [],
              identificadorManual: valor.Identificador || null,
            })
          : await editarEquipamento(gateways.equipamentos, { ...dados, id: valor.Id ?? "" });
      const sistemaAtualId = estado.membros.find(
        (membro) => membro.itemId === componente.id,
      )?.sistemaId;
      const sistemaId = valor.Sistema ? sistemaIdPorNome.get(normalizar(valor.Sistema)) : null;
      if (sistemaAtualId && sistemaAtualId !== sistemaId)
        await removerItem(gateways.sistemas, sistemaAtualId, componente.id);
      if (valor.Sistema) {
        if (!sistemaId) throw new Error(`Sistema «${valor.Sistema}» não existe.`);
        if (sistemaAtualId !== sistemaId)
          await adicionarItem(gateways.sistemas, sistemaId, componente.id, userId);
      }
    },
    onProgresso,
  );
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("pt-BR");
}
function numero(valor: string | undefined) {
  return Number(valor || 0);
}
function chaveLocal(areaId: string | null, caminho: string) {
  return `${areaId ?? ""}|${normalizar(caminho)}`;
}
function caminhoLocal(id: string, estado: EstadoEstrutura) {
  const porId = new Map(estado.locais.map((local) => [local.id, local]));
  const nomes: string[] = [];
  let atual = porId.get(id);
  while (atual) {
    nomes.unshift(atual.nome);
    atual = atual.parentId ? porId.get(atual.parentId) : undefined;
  }
  return nomes.join(" > ");
}
