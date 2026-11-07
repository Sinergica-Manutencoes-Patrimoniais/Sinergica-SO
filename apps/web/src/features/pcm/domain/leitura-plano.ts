export const COLUNAS_CRONOGRAMA = [
  "CONDOMÍNIO",
  "NATUREZA",
  "ÁREA",
  "ANDAR",
  "LOCAL",
  "SISTEMA",
  "TIPO DE EQUIPAMENTO",
  "EQUIPAMENTO",
  "IDENTIFICAÇÃO",
  "PERIODICIDADE",
  "RESPONSÁVEL",
];
const colunasObrigatorias = COLUNAS_CRONOGRAMA;

function dataPlanilha(valor: unknown): string | null {
  if (typeof valor === "number" && Number.isFinite(valor) && valor >= 61 && valor < 3_000_000) {
    const data = new Date(Date.UTC(1899, 11, 30) + Math.floor(valor) * 86_400_000);
    return data.toISOString().slice(0, 10);
  }
  if (valor instanceof Date && !Number.isNaN(valor.valueOf()))
    return valor.toISOString().slice(0, 10);
  if (typeof valor === "string") {
    const brasileira = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
    const iso = brasileira ? `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}` : valor;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const data = new Date(`${iso}T00:00:00Z`);
    if (!Number.isNaN(data.valueOf()) && data.toISOString().slice(0, 10) === iso) return iso;
  }
  return null;
}

// Leitura exclusivamente para conferência. Não resolve cadastros, persiste nem aprova.
export function lerCronogramaPlano(abas: Record<string, unknown[][]>) {
  const linhas = abas.CRONOGRAMA;
  const cabecalho = linhas?.[2];
  if (!linhas || !cabecalho || colunasObrigatorias.some((valor, i) => cabecalho[i] !== valor)) {
    throw new Error("Cabeçalho de cronograma não reconhecido.");
  }
  const tipoTempo = cabecalho[11];
  const unidade =
    tipoTempo === "HS TÉCNICO / OCORR."
      ? "horas"
      : tipoTempo === "TEMPO MÉDIO / OS (MIN)"
        ? "minutos"
        : null;
  if (!unidade) throw new Error("Unidade de duração não reconhecida.");
  const semanas = cabecalho.flatMap((valor, coluna) =>
    typeof valor === "string" && /^S\d{2}$/.test(valor)
      ? [{ codigo: valor, coluna, data: dataPlanilha(linhas[3]?.[coluna]) }]
      : [],
  );
  if (
    !semanas.length ||
    semanas.some((s) => !s.data) ||
    new Set(semanas.map((s) => s.codigo)).size !== semanas.length
  ) {
    throw new Error("Semanas ou datas do cronograma inválidas.");
  }
  if (linhas.length > 10_000) throw new Error("Cronograma excede o limite de linhas.");
  return {
    linhas: linhas.slice(4).flatMap((linha, indice) => {
      if (!linha.some((valor) => valor !== "" && valor !== null && valor !== undefined)) return [];
      return [
        {
          numeroLinha: indice + 5,
          codigoOriginal: linha[8] ?? "",
          disciplina: linha[5] ?? "",
          periodicidadeOriginal: linha[9] ?? "",
          duracao: { valor: linha[11] ?? "", unidade },
          semanas: semanas.map((s) => ({
            codigo: s.codigo,
            data: s.data,
            marcador: linha[s.coluna] ?? "",
          })),
          valoresOriginais: [...linha],
        },
      ];
    }),
  };
}
