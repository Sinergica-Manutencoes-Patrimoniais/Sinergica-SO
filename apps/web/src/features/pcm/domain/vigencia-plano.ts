interface VersaoParaConsulta {
  id: string;
  estado: "rascunho" | "aprovado";
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
}
type Resultado =
  | { tipo: "encontrada"; versaoId: string }
  | { tipo: "nenhuma" | "incompleta" | "conflito" | "data_invalida" | "dados_invalidos" };

function dataValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

/** Consulta informativa sobre lista completa; não autoriza mutações. */
export function consultarVigencia(
  versoes: readonly VersaoParaConsulta[],
  data: string,
  completa: boolean,
): Resultado {
  if (!dataValida(data)) return { tipo: "data_invalida" };
  if (!completa) return { tipo: "incompleta" };
  const aprovadas = versoes.filter((versao) => versao.estado === "aprovado");
  if (
    aprovadas.some(
      (v) =>
        !v.vigenciaInicio ||
        !dataValida(v.vigenciaInicio) ||
        (v.vigenciaFim !== null &&
          (!dataValida(v.vigenciaFim) || v.vigenciaFim < v.vigenciaInicio)),
    )
  ) {
    return { tipo: "dados_invalidos" };
  }
  const vigentes = aprovadas.filter(
    (v) =>
      v.vigenciaInicio !== null &&
      v.vigenciaInicio <= data &&
      (v.vigenciaFim === null || v.vigenciaFim >= data),
  );
  if (vigentes.length > 1) return { tipo: "conflito" };
  const unica = vigentes[0];
  if (!unica) return { tipo: "nenhuma" };
  return { tipo: "encontrada", versaoId: unica.id };
}
