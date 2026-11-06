import { organizarTextoMateriais } from "./listas-materiais";

type Campos = { descricao: string; quantidade: string | null; unidade: string | null };
type Linha = Campos & { trechosOriginais: readonly string[] };
export type EdicaoMateriais = { textoOriginal: string; linhas: readonly Linha[] };

export function criarEdicaoMateriais(texto: string): EdicaoMateriais {
  const resultado = organizarTextoMateriais(texto);
  return {
    textoOriginal: resultado.textoOriginal,
    linhas: resultado.linhas.map(({ trechoOriginal, ...campos }) => ({
      ...campos,
      trechosOriginais: [trechoOriginal],
    })),
  };
}

/** Identifica trechos reconhecíveis da leitura inicial que não aparecem nas linhas atuais.
 * Trechos idênticos podem ocorrer mais de uma vez; divisão pode repetir uma referência.
 * Por isso o resultado é informativo, não prova cobertura de cada ocorrência física.
 */
export function conferirTrechosMateriais(edicao: EdicaoMateriais): { ausentes: string[]; naoReconhecidos: string[] } {
  const originais = new Set(organizarTextoMateriais(edicao.textoOriginal).linhas.map((linha) => linha.trechoOriginal));
  const referenciados = new Set(edicao.linhas.flatMap((linha) => [...linha.trechosOriginais]));
  return {
    ausentes: [...originais].filter((trecho) => !referenciados.has(trecho)),
    naoReconhecidos: [...referenciados].filter((trecho) => !originais.has(trecho)),
  };
}
function validarCampos(campos: Campos): void {
  if (
    !campos.descricao.trim() ||
    (campos.quantidade !== null && !campos.quantidade.trim()) ||
    (campos.unidade !== null && !campos.unidade.trim())
  )
    throw new Error("Linha inválida.");
}

/** Reordena a edição sem modificar o texto ou os trechos de origem. */
export function moverLinhaMaterial(
  edicao: EdicaoMateriais,
  origem: number,
  destino: number,
): EdicaoMateriais {
  if (
    !Number.isInteger(origem) ||
    !Number.isInteger(destino) ||
    origem < 0 ||
    destino < 0 ||
    origem >= edicao.linhas.length ||
    destino >= edicao.linhas.length
  )
    throw new Error("Movimento inválido.");
  if (origem === destino) return edicao;
  const linhas = [...edicao.linhas];
  const [linha] = linhas.splice(origem, 1);
  if (!linha) throw new Error("Linha inexistente.");
  linhas.splice(destino, 0, linha);
  return { textoOriginal: edicao.textoOriginal, linhas };
}
export function dividirLinhaMaterial(
  edicao: EdicaoMateriais,
  indice: number,
  partes: readonly Campos[],
): EdicaoMateriais {
  const original = edicao.linhas[indice];
  if (!Number.isInteger(indice) || !original || partes.length < 2)
    throw new Error("Divisão inválida.");
  partes.forEach(validarCampos);
  return {
    textoOriginal: edicao.textoOriginal,
    linhas: [
      ...edicao.linhas.slice(0, indice),
      ...partes.map((p) => ({ ...p, trechosOriginais: [...original.trechosOriginais] })),
      ...edicao.linhas.slice(indice + 1),
    ],
  };
}
export function juntarLinhasMateriais(
  edicao: EdicaoMateriais,
  indices: readonly number[],
  campos: Campos,
): EdicaoMateriais {
  if (
    indices.length < 2 ||
    new Set(indices).size !== indices.length ||
    indices.some((i) => !Number.isInteger(i) || i < 0 || i >= edicao.linhas.length)
  )
    throw new Error("Junção inválida.");
  validarCampos(campos);
  const ordenados = [...indices].sort((a, b) => a - b);
  const selecionados = new Set(ordenados);
  const novo: Linha = {
    ...campos,
    trechosOriginais: ordenados.flatMap((i) => edicao.linhas[i]?.trechosOriginais ?? []),
  };
  const linhas = edicao.linhas.flatMap((linha, i) =>
    i === ordenados[0] ? [novo] : selecionados.has(i) ? [] : [linha],
  );
  return { textoOriginal: edicao.textoOriginal, linhas };
}
