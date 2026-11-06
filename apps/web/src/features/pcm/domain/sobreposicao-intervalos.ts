export function haSobreposicaoIntervalos(
  intervalos: readonly { inicio: string; fim: string }[],
): boolean {
  const instante = (valor: string) => {
    const partes = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      valor,
    );
    const dia = partes?.[1];
    if (!dia || dia.startsWith("0000")) throw new Error("Intervalo inválido.");
    const data = new Date(`${dia}T00:00:00Z`);
    const numero = Date.parse(valor);
    if (
      !Number.isFinite(numero) ||
      !Number.isFinite(data.getTime()) ||
      data.toISOString().slice(0, 10) !== dia
    )
      throw new Error("Intervalo inválido.");
    return numero;
  };
  const ordenados = intervalos
    .map((i) => {
      const inicio = instante(i.inicio);
      const fim = instante(i.fim);
      if (fim <= inicio) throw new Error("Intervalo inválido.");
      return { inicio, fim };
    })
    .sort((a, b) => a.inicio - b.inicio);
  let maiorFim = Number.NEGATIVE_INFINITY;
  for (const intervalo of ordenados) {
    if (intervalo.inicio < maiorFim) return true;
    maiorFim = Math.max(maiorFim, intervalo.fim);
  }
  return false;
}
