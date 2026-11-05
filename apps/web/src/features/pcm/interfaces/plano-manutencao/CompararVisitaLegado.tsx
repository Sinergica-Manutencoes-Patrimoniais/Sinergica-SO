type Props = { foto: Record<string, unknown>; efeitos: Record<string, unknown> };
/** A comparação usa apenas o par explicitamente selecionado pelo PCM. */
export function CompararVisitaLegado({ foto, efeitos }: Props) {
  const sso = typeof foto.dataSso === "string" ? foto.dataSso : null;
  const legado = typeof foto.dataLegado === "string" ? foto.dataLegado : null;
  const indice = typeof foto.indiceLegado === "number" ? foto.indiceLegado : null;
  const mesmaData = sso !== null && legado !== null && sso === legado;
  const legada = efeitos.legadaExistente;
  return (
    <section aria-label="Comparação da Visita com o legado">
      <h6>Comparação do par selecionado</h6>
      <p>
        Visita SSO: {sso ?? "data indisponível"} · legado, índice {indice ?? "indisponível"}:{" "}
        {legado ?? "data indisponível"}.
      </p>
      <p>
        {sso && legado
          ? mesmaData
            ? "Datas coincidentes: possível conflito; confira as origens."
            : "Datas diferentes: confira antes de decidir; a ponte exige datas iguais."
          : "Comparação de datas indisponível."}
      </p>
      <p>
        {legada === true
          ? "Já existe ocorrência para o índice legado selecionado; confira sua situação."
          : legada === false
            ? "Nenhuma ocorrência encontrada para o índice legado selecionado nas fontes consultadas."
            : "Situação da ocorrência legada não determinada."}
      </p>
      <p>
        A comparação não comprova equivalência nem ausência de execução externa; outros ciclos não
        foram conferidos.
      </p>
    </section>
  );
}
