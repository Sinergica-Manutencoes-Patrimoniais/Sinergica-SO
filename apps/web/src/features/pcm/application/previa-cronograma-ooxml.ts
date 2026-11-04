import type { CelulaOoxml } from "./aba-ooxml.ts";
import { matrizCronogramaOoxml } from "./matriz-cronograma-ooxml.ts";
import { preverImportacaoPlano } from "./prever-importacao-plano.ts";

/** Prévia isolada: não interpreta cache de fórmulas nem grava ou aprova o Plano. */
export function previaCronogramaOoxml(
  celulas: readonly CelulaOoxml[], data1904: boolean,
  fonteId: string, clienteId: string,
  alvos: Parameters<typeof preverImportacaoPlano>[3], escolhas: Parameters<typeof preverImportacaoPlano>[4],
) {
  const { matriz, pendencias } = matrizCronogramaOoxml(celulas, data1904);
  const semanas = new Set(celulas.filter((c) => c.linha === 3 && c.tipo === "texto" && /^S\d{2}$/.test(c.valor ?? "") && !c.formula && !c.formulaCompartilhada).map((c) => c.coluna));
  const porReferencia = new Map(celulas.map((c) => [c.referencia, c]));
  const relevantes = pendencias.filter((p) => {
    const c = porReferencia.get(p.referencia);
    return !c || c.linha === 3 || (c.linha === 4 && semanas.has(c.coluna)) || (c.linha >= 5 && (c.coluna <= 12 || semanas.has(c.coluna)));
  });
  if (relevantes.length) return { estado: "pendente" as const, pendencias: relevantes };
  return { estado: "conferivel" as const, avisos: pendencias, linhas: preverImportacaoPlano({ CRONOGRAMA: matriz }, fonteId, clienteId, alvos, escolhas) };
}
