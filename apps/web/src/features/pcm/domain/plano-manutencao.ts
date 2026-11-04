export type TipoAlvoRotina = "sistema" | "componente" | "grupo";
export interface AlvoRotina {
  id: string;
  tipo: TipoAlvoRotina;
  clienteId: string;
}
export interface RotinaRascunho {
  id: string;
  nome: string;
  alvos: readonly AlvoRotina[];
  modo: "calendario" | "visita";
  intervalo: number | null;
  unidade: "dias" | "semanas" | "meses" | "anos" | null;
  dataBase: string | null;
  instrucao: string | null;
  questionarioId: string | null;
  tempoMinutos: number | null;
  tipoTempo: "total" | "por_unidade" | null;
  toleranciaAntes: number;
  toleranciaDepois: number;
}
export interface PlanoRascunho {
  clienteId: string;
  nome: string;
  rotinas: readonly RotinaRascunho[];
}

export function pendenciasConhecidasRotina(
  rotina: Pick<
    RotinaRascunho,
    | "tempoMinutos"
    | "tipoTempo"
    | "instrucao"
    | "questionarioId"
    | "intervalo"
    | "modo"
    | "dataBase"
  >,
) {
  const pendencias: string[] = [];
  if (!rotina.tempoMinutos) pendencias.push("tempo_a_validar");
  if (rotina.tempoMinutos && !rotina.tipoTempo) pendencias.push("tipo_tempo");
  if (!rotina.instrucao?.trim() && !rotina.questionarioId?.trim())
    pendencias.push("instrucao_ou_questionario");
  if (rotina.intervalo === null) pendencias.push("recorrencia");
  if (rotina.modo === "calendario" && !rotina.dataBase) pendencias.push("data_base");
  return pendencias;
}

/** Prévia local; autorização, integridade e aprovação são responsabilidade do servidor. */
export function avaliarPlanoRascunho(plano: PlanoRascunho) {
  if (!plano.clienteId.trim() || !plano.nome.trim())
    throw new Error("Informe Cliente e nome do Plano.");
  const ids = new Set<string>();
  const rotinas = plano.rotinas.map((rotina) => {
    if (!rotina.id.trim() || ids.has(rotina.id) || !rotina.nome.trim())
      throw new Error("Rotina sem identidade única ou nome.");
    ids.add(rotina.id);
    if (rotina.alvos.length !== 1) throw new Error("Cada Rotina exige um alvo.");
    const alvo = rotina.alvos[0];
    if (
      !alvo ||
      !alvo.id.trim() ||
      alvo.clienteId !== plano.clienteId ||
      !["sistema", "componente", "grupo"].includes(alvo.tipo)
    ) {
      throw new Error("Alvo inválido ou de outro Cliente.");
    }
    if (
      (rotina.intervalo === null) !== (rotina.unidade === null) ||
      (rotina.intervalo !== null &&
        (!Number.isSafeInteger(rotina.intervalo) || rotina.intervalo < 1)) ||
      !Number.isSafeInteger(rotina.toleranciaAntes) ||
      rotina.toleranciaAntes < 0 ||
      !Number.isSafeInteger(rotina.toleranciaDepois) ||
      rotina.toleranciaDepois < 0 ||
      (rotina.tempoMinutos !== null &&
        (!Number.isSafeInteger(rotina.tempoMinutos) || rotina.tempoMinutos < 0))
    ) {
      throw new Error("Recorrência, tempo ou tolerância inválidos.");
    }
    if (rotina.dataBase !== null) {
      const data = new Date(`${rotina.dataBase}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(rotina.dataBase) ||
        Number.isNaN(data.getTime()) ||
        data.toISOString().slice(0, 10) !== rotina.dataBase
      ) {
        throw new Error("Data-base inválida.");
      }
    }
    const pendencias = pendenciasConhecidasRotina(rotina);
    return { ...rotina, alvos: [{ ...alvo }], pendencias };
  });
  return {
    ...plano,
    rotinas,
    possuiPendenciasConhecidas:
      rotinas.length === 0 || rotinas.some((r) => r.pendencias.length > 0),
  };
}
