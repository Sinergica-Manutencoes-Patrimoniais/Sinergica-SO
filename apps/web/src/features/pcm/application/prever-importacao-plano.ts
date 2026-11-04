import { type RecorrenciaMapeada, conferirLinhasPlano } from "../domain/importacao-plano.ts";
import { lerCronogramaPlano } from "../domain/leitura-plano.ts";

type Alvo = {
  id: string;
  clienteId: string;
  tipo: "sistema" | "componente" | "grupo_quantitativo";
};
type Escolha = {
  alvoId: string;
  recorrencia?: RecorrenciaMapeada | null;
  periodicidadeExplicita?: boolean;
};

// CSV preserva texto; aceita apenas representação decimal sem separador de milhar.
// Três casas após separador são ambíguas com milhar e exigem conferência manual.
function duracaoNumerica(valor: unknown): number | null {
  if (valor === null || valor === "") return null;
  if (typeof valor === "number") return valor;
  if (typeof valor !== "string") return Number.NaN;
  const texto = valor.trim();
  if (!texto) return null;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(texto)) return Number.NaN;
  return Number(texto.replace(",", "."));
}

export function preverImportacaoPlano(
  abas: Record<string, unknown[][]>,
  fonteId: string,
  clienteId: string,
  alvos: readonly Alvo[],
  escolhas: Record<number, Escolha>,
) {
  const originais = lerCronogramaPlano(abas).linhas;
  const conferencias = conferirLinhasPlano(
    fonteId,
    clienteId,
    originais.map((linha) => {
      const valor = duracaoNumerica(linha.duracao.valor);
      const horas = valor === null ? null : valor / (linha.duracao.unidade === "minutos" ? 60 : 1);
      return {
        numeroLinha: linha.numeroLinha,
        disciplina: typeof linha.disciplina === "string" ? linha.disciplina : "",
        alvoId: escolhas[linha.numeroLinha]?.alvoId ?? "",
        recorrencia: escolhas[linha.numeroLinha]?.recorrencia,
        horasSpci: horas,
        semanas: linha.semanas.map((semana) => ({
          codigo: semana.codigo,
          data: semana.data ?? "",
          marcador: typeof semana.marcador === "string" ? semana.marcador : String(semana.marcador),
        })),
      };
    }),
    alvos,
  );
  return originais.map((original, i) => {
    const conferencia = conferencias[i];
    if (!conferencia) throw new Error("Conferência incompleta.");
    return { original, conferencia };
  });
}
