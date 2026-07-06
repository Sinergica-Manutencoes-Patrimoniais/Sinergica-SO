export type EventoAgendaTipo = "os" | "inspecao" | "laudo_spda" | "pmoc";

export interface EventoAgendaPcm {
  id: string;
  tipo: EventoAgendaTipo;
  dataIso: string;
  titulo: string;
  clienteNome: string;
  clienteId: string | null;
  status: string;
  responsavel: string | null;
  prioridade?: string | null;
}

export interface ResumoClienteMensal {
  clienteNome: string;
  totalEventos: number;
  ordens: number;
  inspecoes: number;
  laudos: number;
  pmoc: number;
}

function toUtcDate(dataIso: string): Date {
  return new Date(`${dataIso.slice(0, 10)}T00:00:00.000Z`);
}

export function hojeLocalIso(agora = new Date()): string {
  const data = new Date(agora);
  data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
  return data.toISOString().slice(0, 10);
}

export function adicionarDiasIso(dataIso: string, dias: number): string {
  const data = toUtcDate(dataIso);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

export function inicioSemanaIso(dataIso: string): string {
  const data = toUtcDate(dataIso);
  const dia = data.getUTCDay();
  const delta = dia === 0 ? -6 : 1 - dia;
  data.setUTCDate(data.getUTCDate() + delta);
  return data.toISOString().slice(0, 10);
}

export function diasSemanaIso(inicioIso: string): string[] {
  return Array.from({ length: 7 }, (_, index) => adicionarDiasIso(inicioIso, index));
}

export function inicioMesIso(ano: number, mesIndexZero: number): string {
  return new Date(Date.UTC(ano, mesIndexZero, 1)).toISOString().slice(0, 10);
}

export function fimMesIso(ano: number, mesIndexZero: number): string {
  return new Date(Date.UTC(ano, mesIndexZero + 1, 0)).toISOString().slice(0, 10);
}

export function estaNoPeriodo(dataIso: string, inicioIso: string, fimIso: string): boolean {
  const data = dataIso.slice(0, 10);
  return data >= inicioIso && data <= fimIso;
}

export function filtrarEventosPeriodo(
  eventos: readonly EventoAgendaPcm[],
  filtro: { inicioIso: string; fimIso: string; clienteId?: string; termo?: string },
): EventoAgendaPcm[] {
  const termo = filtro.termo?.trim().toLowerCase() ?? "";
  return eventos.filter((evento) => {
    const passaPeriodo = estaNoPeriodo(evento.dataIso, filtro.inicioIso, filtro.fimIso);
    const passaCliente = !filtro.clienteId || evento.clienteId === filtro.clienteId;
    const passaTermo =
      termo.length === 0 ||
      evento.titulo.toLowerCase().includes(termo) ||
      evento.clienteNome.toLowerCase().includes(termo) ||
      evento.status.toLowerCase().includes(termo);
    return passaPeriodo && passaCliente && passaTermo;
  });
}

export function agruparEventosPorData(
  eventos: readonly EventoAgendaPcm[],
): Map<string, EventoAgendaPcm[]> {
  const grupos = new Map<string, EventoAgendaPcm[]>();
  for (const evento of eventos) {
    const data = evento.dataIso.slice(0, 10);
    grupos.set(data, [...(grupos.get(data) ?? []), evento]);
  }
  for (const [data, itens] of grupos) {
    grupos.set(
      data,
      [...itens].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.titulo.localeCompare(b.titulo)),
    );
  }
  return grupos;
}

export function resumirClientesMensal(eventos: readonly EventoAgendaPcm[]): ResumoClienteMensal[] {
  const porCliente = new Map<string, ResumoClienteMensal>();
  for (const evento of eventos) {
    const atual =
      porCliente.get(evento.clienteNome) ??
      ({
        clienteNome: evento.clienteNome,
        totalEventos: 0,
        ordens: 0,
        inspecoes: 0,
        laudos: 0,
        pmoc: 0,
      } satisfies ResumoClienteMensal);

    atual.totalEventos += 1;
    if (evento.tipo === "os") atual.ordens += 1;
    if (evento.tipo === "inspecao") atual.inspecoes += 1;
    if (evento.tipo === "laudo_spda") atual.laudos += 1;
    if (evento.tipo === "pmoc") atual.pmoc += 1;
    porCliente.set(evento.clienteNome, atual);
  }

  return [...porCliente.values()].sort(
    (a, b) => b.totalEventos - a.totalEventos || a.clienteNome.localeCompare(b.clienteNome),
  );
}

export function montarTextoRelatorio(params: {
  titulo: string;
  periodo: string;
  eventos: readonly EventoAgendaPcm[];
}): string {
  const linhas = [
    params.titulo,
    params.periodo,
    "",
    `Total de registros: ${params.eventos.length}`,
    "",
    ...params.eventos.map(
      (evento) =>
        `- ${evento.dataIso.slice(0, 10)} · ${evento.clienteNome} · ${evento.titulo} (${evento.status})`,
    ),
  ];
  return linhas.join("\n");
}
