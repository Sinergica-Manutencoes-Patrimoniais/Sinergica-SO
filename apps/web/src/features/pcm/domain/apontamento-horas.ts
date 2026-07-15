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

/** AC-4: ponte de custo — só calcula quando há valor/hora (E04-S06); sem isso, a tela mostra só
 * horas com nota, sem lançar nem inventar um custo de R$0. */
export function calcularCusto(horas: number, valorHora: number | null | undefined): number | null {
  if (valorHora == null || !Number.isFinite(valorHora)) return null;
  return arredondar(horas * valorHora);
}
