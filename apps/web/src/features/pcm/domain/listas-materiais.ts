export interface LinhaMaterialOrganizada {
  trechoOriginal: string;
  descricao: string;
  quantidade: string | null;
  unidade: string | null;
}

// Somente unidades explicitamente escritas; conservar a grafia da fonte.
const unidadeMaterial = /^(un|und|unid|m|kg|g|l|ml|pc|pç|cx|unidade|unidades|metro|metros|quilo|quilos|quilograma|quilogramas|grama|gramas|litro|litros|mililitro|mililitros|peça|peças|peca|pecas|caixa|caixas)\.?(?=\s|$)/i;

export function organizarTextoMateriais(textoOriginal: string): {
  textoOriginal: string;
  linhas: LinhaMaterialOrganizada[];
} {
  const linhas: LinhaMaterialOrganizada[] = [];
  for (const trechoOriginal of textoOriginal.split(/\r\n|\n|\r/)) {
    if (!trechoOriginal.trim()) continue;
    // A numeração de uma lista é marcador, não quantidade do material.
    // Ex.: "1. 3 parafusos" tem quantidade 3; "1. parafuso" não tem.
    const marcador = /^(?:[-*•]|\d+[.)])\s+/;
    const temMarcador = marcador.test(trechoOriginal.trim());
    const texto = trechoOriginal.trim().replace(marcador, "");
    // Também aceita multiplicador explícito sem espaço antes de x ("3x parafuso").
    // Mantém a separação após x: "3x4" pode ser medida, não quantidade.
    const multiplicadorCompacto = /^(\d+(?:[,.]\d+)?)[xX]\s+(.+)$/.exec(texto);
    const partes = multiplicadorCompacto ?? /^(\d+(?:[,.]\d+)?)\s+(.+)$/.exec(texto);
    const quantidade = partes?.[1];
    let descricao = partes?.[2]?.trim();
    let unidade: string | null = null;
    const temMultiplicador = multiplicadorCompacto !== null || /^x\s+/i.test(descricao ?? "");
    const temUnidade = unidadeMaterial.test(descricao ?? "");
    if (
      quantidade &&
      descricao &&
      // Três casas após separador podem representar milhar ou decimal.
      // Não escolher interpretação automaticamente; manter linha para revisão.
      !/[,.]\d{3,}$/.test(quantidade) &&
      Number(quantidade.replace(",", ".")) > 0 &&
      Number.isFinite(Number(quantidade.replace(",", "."))) &&
      !/^\d/.test(descricao) &&
      (temMarcador || temMultiplicador || temUnidade)
    ) {
      descricao = descricao.replace(/^x\s+/i, "");
      if (/^x$/i.test(descricao)) descricao = "";
      const unidadeExplicita = unidadeMaterial.exec(descricao);
      if (unidadeExplicita) {
        unidade = unidadeExplicita[1] ?? null;
        descricao = descricao.slice(unidadeExplicita[0].length).trim();
      }
      if (descricao) {
        linhas.push({ trechoOriginal, descricao, quantidade, unidade });
        continue;
      }
    }
    linhas.push({ trechoOriginal, descricao: trechoOriginal, quantidade: null, unidade: null });
  }
  return { textoOriginal, linhas };
}
