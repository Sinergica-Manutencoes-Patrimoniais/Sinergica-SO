import type { ApontamentoHorasItem } from "../domain/apontamento-horas";

export interface ClienteOpcaoHoras {
  id: string;
  nome: string;
}

export interface TecnicoOpcaoHoras {
  id: string;
  nome: string;
}

export interface ApontamentoHorasGateway {
  listarApontamentos(inicio: string, fim: string): Promise<ApontamentoHorasItem[]>;
  listarClientes(): Promise<ClienteOpcaoHoras[]>;
  listarTecnicos(): Promise<TecnicoOpcaoHoras[]>;
  /** AC-4: `null` quando `financeiro.custos_funcionario` (E04-S06) ainda não existe — degrada sem
   * lançar, a UI mostra só horas com nota. */
  buscarValorHora(tecnicoFuncionarioId: string): Promise<number | null>;
}
