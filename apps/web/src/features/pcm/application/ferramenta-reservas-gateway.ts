import type {
  CancelarReservaFormData,
  CriarReservaFormData,
  EfetivarReservaFormData,
  FerramentaReservaItem,
} from "../domain/ferramenta-reservas";

export interface CriarReservaCommand extends CriarReservaFormData {
  userId: string;
}

export interface EfetivarReservaCommand extends EfetivarReservaFormData {
  userId: string;
}

export interface CancelarReservaCommand extends CancelarReservaFormData {
  userId: string;
}

export interface FerramentaReservasGateway {
  listarReservas(): Promise<FerramentaReservaItem[]>;
  criar(input: CriarReservaCommand): Promise<FerramentaReservaItem>;
  /** Efetiva: grava a atribuição real (via `FerramentaUnidadesGateway.atribuir`, orquestrado no
   * caso de uso — este método só marca a reserva como `efetivada`). */
  marcarEfetivada(reservaId: string, unidadeId: string, userId: string): Promise<void>;
  cancelar(input: CancelarReservaCommand): Promise<void>;
}
