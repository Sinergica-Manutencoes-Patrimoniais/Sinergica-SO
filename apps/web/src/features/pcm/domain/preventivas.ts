export type UnidadeRecorrenciaPreventiva = "semanas" | "meses";

export interface PlanoPreventivoRecorrente {
  dataInicial: string;
  intervalo: {
    quantidade: number;
    unidade: UnidadeRecorrenciaPreventiva;
  };
}

export type StatusOcorrenciaPreventiva =
  | "prevista"
  | "atrasada"
  | "agendada"
  | "auvo_disponivel"
  | "concluida";

export interface OcorrenciaPreventiva {
  vencimento: string;
  ordemServico?: {
    status: string;
    auvoDisponivel?: boolean;
  } | null;
}

function dataUtc(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error("Data inválida.");

  const [, anoTexto, mesTexto, diaTexto] = match;
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);
  const data = new Date(Date.UTC(ano, mes - 1, dia));

  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    throw new Error("Data inválida.");
  }

  return data;
}

function isoUtc(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function validarIntervalo(intervalo: PlanoPreventivoRecorrente["intervalo"]): void {
  if (!Number.isInteger(intervalo.quantidade) || intervalo.quantidade <= 0) {
    throw new Error("Intervalo deve ser inteiro positivo.");
  }
}

function adicionarMesesAncorado(ancora: Date, meses: number): Date {
  const ano = ancora.getUTCFullYear();
  const mes = ancora.getUTCMonth() + meses;
  const diaOriginal = ancora.getUTCDate();
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(diaOriginal, ultimoDia)));
}

function vencimentoNaOcorrencia(
  ancora: Date,
  intervalo: PlanoPreventivoRecorrente["intervalo"],
  indice: number,
): Date {
  if (intervalo.unidade === "semanas") {
    return new Date(ancora.getTime() + indice * intervalo.quantidade * 7 * 86_400_000);
  }
  return adicionarMesesAncorado(ancora, indice * intervalo.quantidade);
}

/** Gera datas inclusivas no intervalo, sempre calculadas da âncora original do plano. */
export function gerarVencimentosPreventivos(
  plano: PlanoPreventivoRecorrente,
  inicio: string,
  fim: string,
): string[] {
  const ancora = dataUtc(plano.dataInicial);
  const inicioUtc = dataUtc(inicio);
  const fimUtc = dataUtc(fim);
  validarIntervalo(plano.intervalo);
  if (inicioUtc > fimUtc) throw new Error("Intervalo de datas inválido.");

  const resultado: string[] = [];
  for (let indice = 0; ; indice += 1) {
    const vencimento = vencimentoNaOcorrencia(ancora, plano.intervalo, indice);
    if (vencimento > fimUtc) break;
    if (vencimento >= inicioUtc) resultado.push(isoUtc(vencimento));
  }
  return resultado;
}

function osConcluida(status: string): boolean {
  return ["finalizado", "finalizada", "concluido", "concluida"].includes(status);
}

/** Estado de leitura; a ocorrência e a OS permanecem fontes de verdade separadas. */
export function calcularStatusOcorrenciaPreventiva(
  ocorrencia: OcorrenciaPreventiva,
  hoje: string,
): StatusOcorrenciaPreventiva {
  dataUtc(ocorrencia.vencimento);
  dataUtc(hoje);

  if (ocorrencia.ordemServico && osConcluida(ocorrencia.ordemServico.status)) return "concluida";
  if (ocorrencia.ordemServico?.auvoDisponivel) return "auvo_disponivel";
  if (ocorrencia.ordemServico) return "agendada";
  return ocorrencia.vencimento < hoje ? "atrasada" : "prevista";
}
