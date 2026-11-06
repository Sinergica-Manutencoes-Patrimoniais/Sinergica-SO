export function interpretarMarcadorPlano(
  valor: string,
):
  | { estado: "programado" }
  | { estado: "sem_marcacao" }
  | { estado: "desconhecido"; original: string } {
  const normalizado = valor.trim();
  if (!normalizado) return { estado: "sem_marcacao" };
  if (normalizado.toUpperCase() === "X") return { estado: "programado" };
  return { estado: "desconhecido", original: valor };
}

export function interpretarTempoSpci(
  horas: number | null,
): { estado: "tempo_a_validar"; horas: null } | { estado: "informado"; horas: number } {
  if (horas === null || horas === 0) return { estado: "tempo_a_validar", horas: null };
  if (!Number.isFinite(horas) || horas < 0) throw new Error("Tempo SPCI inválido.");
  return { estado: "informado", horas };
}

type AlvoFonte = {
  id: string;
  clienteId: string;
  tipo: "sistema" | "componente" | "grupo_quantitativo";
};
export type RecorrenciaMapeada = {
  modo: "calendario" | "visita";
  intervalo: number;
  unidade: "dias" | "semanas" | "meses" | "anos";
  dataBase: string | null;
};
type LinhaFonte = {
  numeroLinha: number;
  disciplina: string;
  alvoId: string;
  horasSpci: number | null;
  recorrencia?: RecorrenciaMapeada | null;
  semanas: { codigo: string; data: string; marcador: string }[];
};
export function conferirLinhasPlano(
  fonteId: string,
  clienteId: string,
  linhas: readonly LinhaFonte[],
  alvos: readonly AlvoFonte[],
) {
  if (!fonteId.trim() || !clienteId.trim()) throw new Error("Fonte e Cliente são obrigatórios.");
  const contagens = new Map<number, number>();
  for (const linha of linhas)
    contagens.set(linha.numeroLinha, (contagens.get(linha.numeroLinha) ?? 0) + 1);
  return linhas.map((linha) => {
    const erros: string[] = [];
    if (!Number.isSafeInteger(linha.numeroLinha) || linha.numeroLinha < 1)
      erros.push("linha_invalida");
    if ((contagens.get(linha.numeroLinha) ?? 0) > 1) erros.push("linha_duplicada");
    const correspondencias = alvos.filter(
      (alvo) => linha.alvoId.trim() && alvo.id === linha.alvoId && alvo.clienteId === clienteId,
    );
    const encontrado = correspondencias.length === 1 ? correspondencias[0] : undefined;
    const alvo =
      encontrado && ["sistema", "componente", "grupo_quantitativo"].includes(encontrado.tipo)
        ? encontrado
        : undefined;
    if (correspondencias.length === 0) erros.push("alvo_nao_encontrado");
    if (correspondencias.length > 1) erros.push("alvo_ambiguo");
    if (encontrado && !alvo) erros.push("alvo_invalido");
    const recorrencia = linha.recorrencia;
    const dataBase = recorrencia?.dataBase;
    const data =
      typeof dataBase === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dataBase)
        ? new Date(`${dataBase}T00:00:00.000Z`)
        : null;
    const dataValida =
      data !== null &&
      Number.isFinite(data.valueOf()) &&
      data.toISOString().slice(0, 10) === dataBase;
    const recorrenciaValida =
      recorrencia != null &&
      (recorrencia.modo === "calendario" || recorrencia.modo === "visita") &&
      Number.isSafeInteger(recorrencia.intervalo) &&
      recorrencia.intervalo > 0 &&
      ["dias", "semanas", "meses", "anos"].includes(recorrencia.unidade) &&
      (recorrencia.modo === "calendario" ? dataValida : dataBase === null || dataValida);
    if (!recorrenciaValida) erros.push("periodicidade_nao_confirmada");
    const semanas = linha.semanas.map(({ codigo, data, marcador }) => ({
      codigo,
      data,
      marcadorOriginal: marcador,
      ...interpretarMarcadorPlano(marcador),
    }));
    if (semanas.some((semana) => semana.estado === "desconhecido"))
      erros.push("marcador_desconhecido");
    let tempo: ReturnType<typeof interpretarTempoSpci> | null;
    try {
      tempo = interpretarTempoSpci(linha.horasSpci);
    } catch {
      tempo = null;
      erros.push("tempo_invalido");
    }
    return {
      fonteId,
      numeroLinha: linha.numeroLinha,
      disciplina: linha.disciplina,
      alvo,
      recorrencia: recorrenciaValida ? { ...recorrencia } : null,
      horasOriginais: linha.horasSpci,
      tempo,
      semanas,
      erros,
    };
  });
}
