export interface ApontamentoHorasItem {
  osId: string;
  osNumero: string;
  clienteId: string | null;
  clienteNome: string;
  tecnicoFuncionarioId: string | null;
  tecnicoNome: string;
  dataAgendada: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  horas: number;
  /** Fonte de ponto ainda não integrada no dataset atual. Ausência é `null`, nunca zero. */
  pontoHoras?: number | null;
}

export interface ParametrosApontamentoHoras {
  metaDiariaHoras: number;
  toleranciaMinutos: number;
  limiarAnomaliaMinutos: number;
}

export interface ConsistenciaDia {
  chave: string;
  tecnicoNome: string;
  dia: string;
  horasOs: number;
  janelaVisitaHoras: number | null;
  pontoHoras: number | null;
  divergente: boolean;
}

export interface AgregadoHoras {
  chave: string;
  nome: string;
  totalHoras: number;
  totalOs: number;
}

export interface FiltrosApontamentoHoras {
  inicio: string;
  fim: string;
  tecnicoFuncionarioId?: string | null;
  clienteId?: string | null;
}

/** AC-1: prioridade `duracaoHoras` (vem de `auvo_detalhes`, já é o `durationDecimal` do Auvo);
 * sem isso, deriva de `check_out_at − check_in_at`; sem nenhum dos dois, 0 (OS aparece, não some). */
export function calcularHorasOs(
  duracaoHoras: number | null,
  checkInAt: string | null,
  checkOutAt: string | null,
): number {
  if (duracaoHoras != null && Number.isFinite(duracaoHoras)) {
    return arredondar(duracaoHoras);
  }
  if (checkInAt && checkOutAt) {
    const inicio = new Date(checkInAt).getTime();
    const fim = new Date(checkOutAt).getTime();
    if (Number.isFinite(inicio) && Number.isFinite(fim) && fim > inicio) {
      return arredondar((fim - inicio) / 3_600_000);
    }
  }
  return 0;
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function filtrarApontamentos(
  itens: ApontamentoHorasItem[],
  filtros: FiltrosApontamentoHoras,
): ApontamentoHorasItem[] {
  return itens.filter((item) => {
    if (
      filtros.tecnicoFuncionarioId &&
      item.tecnicoFuncionarioId !== filtros.tecnicoFuncionarioId
    ) {
      return false;
    }
    if (filtros.clienteId && item.clienteId !== filtros.clienteId) return false;
    return true;
  });
}

/** AC-2: agregação por cliente/técnico — mesma função pra ambos, dado o par (chave, nome). */
function agregarPor(
  itens: ApontamentoHorasItem[],
  chaveDe: (item: ApontamentoHorasItem) => string | null,
  nomeDe: (item: ApontamentoHorasItem) => string,
): AgregadoHoras[] {
  const porChave = new Map<string, AgregadoHoras>();
  for (const item of itens) {
    const chave = chaveDe(item) ?? "sem-vinculo";
    const atual = porChave.get(chave) ?? {
      chave,
      nome: nomeDe(item),
      totalHoras: 0,
      totalOs: 0,
    };
    atual.totalHoras = arredondar(atual.totalHoras + item.horas);
    atual.totalOs += 1;
    porChave.set(chave, atual);
  }
  return [...porChave.values()].sort((a, b) => b.totalHoras - a.totalHoras);
}

export function agregarPorCliente(itens: ApontamentoHorasItem[]): AgregadoHoras[] {
  return agregarPor(
    itens,
    (item) => item.clienteId,
    (item) => item.clienteNome || "Sem cliente",
  );
}

export function agregarPorTecnico(itens: ApontamentoHorasItem[]): AgregadoHoras[] {
  return agregarPor(
    itens,
    (item) => item.tecnicoFuncionarioId,
    (item) => item.tecnicoNome || "Sem técnico",
  );
}

export function produtividadeDiaria(dias: DiaTecnico[], metaDiariaHoras: number) {
  return dias.map((dia) => ({
    ...dia,
    metaDiariaHoras,
    desvioHoras: arredondar(dia.somaOsHoras - metaDiariaHoras),
  }));
}

export function analisarConsistencia(
  dias: DiaTecnico[],
  itens: ApontamentoHorasItem[],
  toleranciaMinutos: number,
): ConsistenciaDia[] {
  return dias.map((dia) => {
    const pontoValores = itens
      .filter((item) => {
        const itemDia = diaLocal(item.checkInAt) ?? diaLocal(item.checkOutAt);
        return item.tecnicoFuncionarioId === dia.tecnicoFuncionarioId && itemDia === dia.dia;
      })
      .map((item) => item.pontoHoras)
      .filter((valor): valor is number => valor != null && Number.isFinite(valor));
    const pontoHoras = pontoValores.length
      ? arredondar(pontoValores.reduce((soma, valor) => soma + valor, 0))
      : null;
    const janelaVisitaHoras = dia.incompleto ? null : dia.diferencaDiaHoras;
    const fontes = [dia.somaOsHoras, janelaVisitaHoras, pontoHoras].filter(
      (valor): valor is number => valor != null,
    );
    const amplitudeMinutos =
      fontes.length > 1 ? (Math.max(...fontes) - Math.min(...fontes)) * 60 : 0;
    return {
      chave: dia.chave,
      tecnicoNome: dia.tecnicoNome,
      dia: dia.dia,
      horasOs: dia.somaOsHoras,
      janelaVisitaHoras,
      pontoHoras,
      divergente: amplitudeMinutos > toleranciaMinutos,
    };
  });
}

export function listarAnomalias(itens: ApontamentoHorasItem[], limiarMinutos: number) {
  return itens
    .filter((item) => item.horas > 0 && item.horas * 60 < limiarMinutos)
    .sort((a, b) => a.horas - b.horas);
}

/** AC-4: ponte de custo — só calcula quando há valor/hora (E04-S06); sem isso, a tela mostra só
 * horas com nota, sem lançar nem inventar um custo de R$0. */
export function calcularCusto(horas: number, valorHora: number | null | undefined): number | null {
  if (valorHora == null || !Number.isFinite(valorHora)) return null;
  return arredondar(horas * valorHora);
}

// ─────────────────────────────────────────────────────────────────────────────
// E01-S77 — Visão diária de apontamento de horas por técnico
// ─────────────────────────────────────────────────────────────────────────────

/** Fuso de Brasília, fixo −03:00 (Brasil sem horário de verão desde 2019 — mesma premissa de
 * `_shared/auvo/datetime.ts`/E01-S68). O "dia" e as horas de um apontamento são sempre o dia local. */
const OFFSET_BRASILIA_HORAS = -3;

function deslocarParaLocal(iso: string, offsetHoras = OFFSET_BRASILIA_HORAS): Date | null {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + offsetHoras * 3_600_000);
}

/** Data local (yyyy-mm-dd) de um timestamp UTC no fuso de Brasília. `null` se o ISO for inválido. */
export function diaLocal(iso: string | null, offsetHoras = OFFSET_BRASILIA_HORAS): string | null {
  if (!iso) return null;
  const local = deslocarParaLocal(iso, offsetHoras);
  return local ? local.toISOString().slice(0, 10) : null;
}

/** Hora local (HH:MM) de um timestamp UTC no fuso de Brasília. `—` se ausente/inválido. */
export function horaLocal(iso: string | null, offsetHoras = OFFSET_BRASILIA_HORAS): string {
  if (!iso) return "—";
  const local = deslocarParaLocal(iso, offsetHoras);
  return local ? local.toISOString().slice(11, 16) : "—";
}

/** AC-2/AC-3/AC-4: formata horas decimais como `HHhMMmin` (ex.: `8h24min`), nunca decimal.
 * Negativo nunca ocorre no domínio (spans e somas são ≥ 0); por segurança, clampa em 0. */
export function formatarHorasMinutos(horas: number): string {
  const seguro = Number.isFinite(horas) && horas > 0 ? horas : 0;
  const totalMinutos = Math.round(seguro * 60);
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  return `${h}h${String(m).padStart(2, "0")}min`;
}

export type SinalJornada = "ok" | "falta" | "hora-extra" | null;

export interface OrdemDoDia {
  osId: string;
  osNumero: string;
  clienteNome: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  horas: number;
}

export interface DiaTecnico {
  chave: string;
  tecnicoFuncionarioId: string | null;
  tecnicoNome: string;
  dia: string; // yyyy-mm-dd (local Brasília)
  primeiroCheckIn: string | null;
  ultimoCheckOut: string | null;
  /** AC-2: span do dia (1º check-in → último check-out do mesmo dia), em horas. 0 se não há par
   * válido no dia (dia incompleto). */
  diferencaDiaHoras: number;
  /** AC-3: soma das durações individuais das OS do dia (usa a duração real de cada OS). */
  somaOsHoras: number;
  quantidadeOs: number;
  /** AC-5: alguma OS do dia sem check-in ou sem check-out no próprio dia (inclui cruzar meia-noite). */
  incompleto: boolean;
  /** AC-6: preenchido na application a partir da jornada do funcionário; `null` = neutro. */
  sinalJornada: SinalJornada;
  ordens: OrdemDoDia[];
}

/** AC-1..AC-5: agrupa apontamentos por (técnico, dia local). A OS é atribuída ao dia do `check_in_at`
 * (ou do `check_out_at` se não houver check-in). O span do dia (AC-2) só considera check-in/out que
 * caem no próprio dia; OS que cruza a meia-noite conta a duração cheia na soma (AC-3) mas marca o dia
 * incompleto (AC-5). */
export function agruparPorDia(itens: ApontamentoHorasItem[]): DiaTecnico[] {
  const porChave = new Map<string, DiaTecnico>();
  for (const item of itens) {
    const dia = diaLocal(item.checkInAt) ?? diaLocal(item.checkOutAt);
    if (!dia) continue; // AC borda: OS sem check-in nem check-out não entra em nenhuma linha de dia
    const tecnicoId = item.tecnicoFuncionarioId;
    const chave = `${tecnicoId ?? "sem-tecnico"}|${dia}`;
    const grupo = porChave.get(chave) ?? {
      chave,
      tecnicoFuncionarioId: tecnicoId,
      tecnicoNome: item.tecnicoNome || "Sem técnico",
      dia,
      primeiroCheckIn: null,
      ultimoCheckOut: null,
      diferencaDiaHoras: 0,
      somaOsHoras: 0,
      quantidadeOs: 0,
      incompleto: false,
      sinalJornada: null as SinalJornada,
      ordens: [] as OrdemDoDia[],
    };

    const checkInNoDia = diaLocal(item.checkInAt) === dia;
    const checkOutNoDia = diaLocal(item.checkOutAt) === dia;
    // AC-5: OS sem par completo dentro do próprio dia (falta check-in, falta check-out, ou cruzou
    // a meia-noite) deixa o dia incompleto.
    if (!checkInNoDia || !checkOutNoDia) grupo.incompleto = true;
    if (checkInNoDia && item.checkInAt) {
      if (!grupo.primeiroCheckIn || item.checkInAt < grupo.primeiroCheckIn) {
        grupo.primeiroCheckIn = item.checkInAt;
      }
    }
    if (checkOutNoDia && item.checkOutAt) {
      if (!grupo.ultimoCheckOut || item.checkOutAt > grupo.ultimoCheckOut) {
        grupo.ultimoCheckOut = item.checkOutAt;
      }
    }
    grupo.somaOsHoras = arredondar(grupo.somaOsHoras + item.horas);
    grupo.quantidadeOs += 1;
    grupo.ordens.push({
      osId: item.osId,
      osNumero: item.osNumero,
      clienteNome: item.clienteNome,
      checkInAt: item.checkInAt,
      checkOutAt: item.checkOutAt,
      horas: item.horas,
    });
    porChave.set(chave, grupo);
  }

  for (const grupo of porChave.values()) {
    if (grupo.primeiroCheckIn && grupo.ultimoCheckOut) {
      const span =
        (new Date(grupo.ultimoCheckOut).getTime() - new Date(grupo.primeiroCheckIn).getTime()) /
        3_600_000;
      grupo.diferencaDiaHoras = span > 0 ? arredondar(span) : 0;
    }
  }

  return [...porChave.values()].sort((a, b) =>
    a.dia === b.dia ? a.tecnicoNome.localeCompare(b.tecnicoNome) : b.dia.localeCompare(a.dia),
  );
}

/** AC-6: compara o span do dia com a jornada esperada. Tolerância de 15min pra cima/baixo = `ok`.
 * Sem jornada cadastrada → `null` (neutro, não é erro). */
export function sinalizarJornada(
  diferencaDiaHoras: number,
  jornadaEsperada: number | null | undefined,
): SinalJornada {
  if (jornadaEsperada == null || !Number.isFinite(jornadaEsperada)) return null;
  const tolerancia = 0.25; // 15 min
  if (diferencaDiaHoras < jornadaEsperada - tolerancia) return "falta";
  if (diferencaDiaHoras > jornadaEsperada + tolerancia) return "hora-extra";
  return "ok";
}

const STATUS_LABEL: Record<Exclude<SinalJornada, null> | "incompleto" | "completo", string> = {
  incompleto: "incompleto",
  falta: "abaixo da jornada",
  "hora-extra": "hora extra",
  ok: "completo",
  completo: "completo",
};

function statusDoDia(dia: DiaTecnico): string {
  if (dia.incompleto) return STATUS_LABEL.incompleto;
  if (dia.sinalJornada) return STATUS_LABEL[dia.sinalJornada];
  return STATUS_LABEL.completo;
}

function escaparCsv(valor: string): string {
  return /[",;\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** AC-7: CSV com técnico, dia, check-in, check-out, diferença do dia, soma das OS, qtd OS, status.
 * Separador `;` (padrão pt-BR do Excel), campos escapados. */
export function gerarCsvApontamento(dias: DiaTecnico[]): string {
  const cabecalho = [
    "Técnico",
    "Dia",
    "Check-in",
    "Check-out",
    "Diferença do dia",
    "Soma das OS",
    "Qtd OS",
    "Status",
  ];
  const linhas = dias.map((dia) =>
    [
      dia.tecnicoNome,
      dia.dia,
      horaLocal(dia.primeiroCheckIn),
      horaLocal(dia.ultimoCheckOut),
      formatarHorasMinutos(dia.diferencaDiaHoras),
      formatarHorasMinutos(dia.somaOsHoras),
      String(dia.quantidadeOs),
      statusDoDia(dia),
    ]
      .map(escaparCsv)
      .join(";"),
  );
  return [cabecalho.join(";"), ...linhas].join("\n");
}

export interface TendenciaSemana {
  semanaInicio: string; // segunda-feira (yyyy-mm-dd, local)
  totalHoras: number;
  quantidadeOs: number;
}

/** Segunda-feira da semana (ISO) de uma data local yyyy-mm-dd. */
function segundaDaSemana(diaIso: string): string {
  const d = new Date(`${diaIso}T00:00:00Z`);
  const diaSemana = d.getUTCDay(); // 0=domingo..6=sábado
  const recuo = (diaSemana + 6) % 7; // dias desde a última segunda
  d.setUTCDate(d.getUTCDate() - recuo);
  return d.toISOString().slice(0, 10);
}

/** AC-8: soma das horas de OS agregadas por semana (segunda a domingo), pra ver padrão no tempo. */
export function agregarPorSemana(itens: ApontamentoHorasItem[]): TendenciaSemana[] {
  const porSemana = new Map<string, TendenciaSemana>();
  for (const item of itens) {
    const dia = diaLocal(item.checkInAt) ?? diaLocal(item.checkOutAt);
    if (!dia) continue;
    const semanaInicio = segundaDaSemana(dia);
    const atual = porSemana.get(semanaInicio) ?? {
      semanaInicio,
      totalHoras: 0,
      quantidadeOs: 0,
    };
    atual.totalHoras = arredondar(atual.totalHoras + item.horas);
    atual.quantidadeOs += 1;
    porSemana.set(semanaInicio, atual);
  }
  return [...porSemana.values()].sort((a, b) => a.semanaInicio.localeCompare(b.semanaInicio));
}
