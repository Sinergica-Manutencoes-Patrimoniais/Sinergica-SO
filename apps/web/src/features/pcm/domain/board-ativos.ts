// domain/board-ativos.ts — E01-S78. Monta o board de ativos de uma Área: colunas por Local
// nível-1 (filho direto da Área), com itens de sub-locais agrupados por sub-local, mais a coluna
// sintética "Sem local". Função pura (sem I/O) — o dado vem dos gateways de E01-S76.

import type { EquipamentoItem, ItemTipo } from "./equipamentos";
import type { Area, Local } from "./hierarquia";

export interface ItemCard {
  id: string;
  nome: string;
  tipo: ItemTipo;
  urlImagem: string | null;
  ativo: boolean;
  localId: string | null;
}

export interface SubGrupoLocal {
  localId: string;
  localNome: string;
  itens: ItemCard[];
}

export interface ColunaBoard {
  /** id do Local nível-1; `null` na coluna sintética "Sem local". */
  localId: string | null;
  localNome: string;
  /** itens instalados diretamente no Local nível-1 (sem subgrupo). */
  itensDiretos: ItemCard[];
  /** itens instalados em sub-locais, agrupados pelo sub-local. */
  subgrupos: SubGrupoLocal[];
  totalItens: number;
}

function toCard(item: EquipamentoItem): ItemCard {
  return {
    id: item.id,
    nome: item.nome,
    tipo: item.tipo,
    urlImagem: item.urlImagem,
    ativo: item.ativo,
    localId: item.localId,
  };
}

/** AC-2/AC-3: colunas = Locais nível-1 da Área (ordenados por `ordem`, `nome`); sub-locais viram
 * subgrupos dentro da coluna do ancestral nível-1; itens sem `localId` vão pra coluna "Sem local".
 * Itens cujo `localId` é de outra Área não entram (aparecem quando a Área deles é selecionada). */
export function montarColunasBoard(
  area: Area,
  locaisDoCliente: Local[],
  itensDoCliente: EquipamentoItem[],
): ColunaBoard[] {
  const locaisDaArea = locaisDoCliente.filter((l) => l.areaId === area.id);
  const porId = new Map(locaisDaArea.map((l) => [l.id, l]));

  // Ancestral nível-1 (filho direto da Área) de um Local, subindo pela cadeia de parentId.
  function nivel1De(localId: string): string | null {
    let cursor = porId.get(localId);
    let guard = 0;
    while (cursor?.parentId && porId.has(cursor.parentId)) {
      cursor = porId.get(cursor.parentId);
      if (++guard > 100) break;
    }
    return cursor ? cursor.id : null;
  }

  const nivel1Locais = locaisDaArea
    .filter((l) => l.parentId === null)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

  const colunasPorNivel1 = new Map<string, ColunaBoard>();
  for (const l of nivel1Locais) {
    colunasPorNivel1.set(l.id, {
      localId: l.id,
      localNome: l.nome,
      itensDiretos: [],
      subgrupos: [],
      totalItens: 0,
    });
  }
  // nivel1Id -> (subLocalId -> subgrupo)
  const subgrupoPorColuna = new Map<string, Map<string, SubGrupoLocal>>();
  const semLocal: ColunaBoard = {
    localId: null,
    localNome: "Sem local",
    itensDiretos: [],
    subgrupos: [],
    totalItens: 0,
  };

  for (const item of itensDoCliente) {
    const card = toCard(item);
    if (!item.localId) {
      semLocal.itensDiretos.push(card);
      continue;
    }
    const local = porId.get(item.localId);
    if (!local) continue; // localId de outra Área — fora deste board
    const n1 = nivel1De(item.localId);
    if (!n1) continue;
    const coluna = colunasPorNivel1.get(n1);
    if (!coluna) continue;
    if (item.localId === n1) {
      coluna.itensDiretos.push(card);
      continue;
    }
    let subs = subgrupoPorColuna.get(n1);
    if (!subs) {
      subs = new Map();
      subgrupoPorColuna.set(n1, subs);
    }
    let sg = subs.get(item.localId);
    if (!sg) {
      sg = { localId: item.localId, localNome: local.nome, itens: [] };
      subs.set(item.localId, sg);
    }
    sg.itens.push(card);
  }

  const colunas: ColunaBoard[] = [];
  for (const l of nivel1Locais) {
    const coluna = colunasPorNivel1.get(l.id);
    if (!coluna) continue;
    const subs = subgrupoPorColuna.get(l.id);
    if (subs) {
      coluna.subgrupos = [...subs.values()].sort((a, b) => a.localNome.localeCompare(b.localNome));
      for (const sg of coluna.subgrupos) sg.itens.sort((a, b) => a.nome.localeCompare(b.nome));
    }
    coluna.itensDiretos.sort((a, b) => a.nome.localeCompare(b.nome));
    coluna.totalItens =
      coluna.itensDiretos.length + coluna.subgrupos.reduce((s, g) => s + g.itens.length, 0);
    colunas.push(coluna);
  }
  if (semLocal.itensDiretos.length > 0) {
    semLocal.itensDiretos.sort((a, b) => a.nome.localeCompare(b.nome));
    semLocal.totalItens = semLocal.itensDiretos.length;
    colunas.push(semLocal);
  }
  return colunas;
}
