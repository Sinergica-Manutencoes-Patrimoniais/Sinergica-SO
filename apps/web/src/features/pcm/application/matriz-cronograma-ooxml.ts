import type { CelulaOoxml } from "./aba-ooxml.ts";

/** Produz prévia local. Caches de fórmula e erros nunca viram valores aprováveis. */
export function matrizCronogramaOoxml(celulas: readonly CelulaOoxml[], data1904: boolean) {
  const matriz: (string | number | boolean | null)[][] = [];
  const pendencias: { referencia: string; motivo: "formula" | "erro" }[] = [];
  const coordenadas = new Set<string>();
  let posicoes = 0;
  const semanas = new Set(celulas.filter((c) => c.linha === 3 && c.tipo === "texto" && /^S\d{2}$/.test(c.valor ?? "")).map((c) => c.coluna));
  for (const c of celulas) {
    if (!Number.isInteger(c.linha) || c.linha < 1 || c.linha > 10_000 || !Number.isInteger(c.coluna) || c.coluna < 1 || c.coluna > 500) throw new Error("Coordenada fora do limite.");
    const coordenada = `${c.linha}:${c.coluna}`;
    if (coordenadas.has(coordenada)) throw new Error("Coordenada duplicada.");
    coordenadas.add(coordenada);
    posicoes += Math.max(0, c.coluna - (matriz[c.linha - 1]?.length ?? 0));
    if (posicoes > 200_000) throw new Error("Matriz esparsa extensa.");
    while (matriz.length < c.linha) matriz.push([]);
    const linha = matriz[c.linha - 1]!;
    while (linha.length < c.coluna) linha.push(null);
    if (c.formula !== null || c.formulaCompartilhada) { pendencias.push({ referencia: c.referencia, motivo: "formula" }); continue; }
    if (c.tipo === "erro") { pendencias.push({ referencia: c.referencia, motivo: "erro" }); continue; }
    let valor: string | number | boolean | null = c.valor;
    if (c.tipo === "numero") {
      const numero = Number(c.valor);
      if (c.valor === null || !Number.isFinite(numero)) throw new Error("Número inválido.");
      if (c.linha === 4 && semanas.has(c.coluna)) {
        const dia = Math.floor(numero);
        if (dia < (data1904 ? 0 : 1) || (!data1904 && dia === 60) || dia > 2_958_465) throw new Error("Data de semana inválida.");
        const origem = data1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, dia < 60 ? 31 : 30);
        const data = new Date(origem + dia * 86_400_000);
        if (!Number.isFinite(data.valueOf()) || data.getUTCFullYear() > 9999) throw new Error("Data de semana inválida.");
        valor = data.toISOString().slice(0, 10);
      } else valor = numero;
    } else if (c.tipo === "booleano") valor = c.valor === "1";
    linha[c.coluna - 1] = valor;
  }
  if (new TextEncoder().encode(JSON.stringify(matriz)).length > 1_048_576) throw new Error("Matriz excede 1 MiB.");
  return { matriz, pendencias };
}
