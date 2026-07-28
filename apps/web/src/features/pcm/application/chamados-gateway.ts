import type {
  Chamado,
  ChamadoFormData,
  HistoricoAtendimentoChamado,
  StatusChamado,
} from "../domain/chamados";

export interface FiltrosChamados {
  clienteId?: string;
  status?: StatusChamado;
}

export interface CriarChamadoCommand extends ChamadoFormData {
  userId: string;
}

export interface ChamadosGateway {
  listar(filtros?: FiltrosChamados): Promise<Chamado[]>;
  obter(id: string): Promise<Chamado | null>;
  criar(input: CriarChamadoCommand): Promise<Chamado>;
  /** AC-3: registra o vínculo com a OS gerada e atualiza o status do Chamado. */
  marcarStatusComOs(
    chamadoId: string,
    status: "convertido_os" | "backlog",
    ordemServicoId: string,
    userId: string,
  ): Promise<void>;
  /** AC-4: `anexoPath` já upado no Storage (ver `uploadAnexoCancelamento`) — `null` se sem anexo. */
  cancelar(
    chamadoId: string,
    justificativa: string,
    anexoPath: string | null,
    userId: string,
  ): Promise<void>;
  uploadAnexoCancelamento(chamadoId: string, arquivo: File): Promise<string>;
  /** E01-S89: histórico de conversa anexado pelo Atendimento — leitura direta de
   * `atendimento.historico_chamado_snapshots`, sem importar código de `features/atendimento/`. */
  listarHistoricoAtendimento(chamadoId: string): Promise<HistoricoAtendimentoChamado[]>;
  /** E01-S101 AC-3: define/reagenda a data planejada — `incrementarReplanejamento` já vem
   * calculado pelo caso de uso (`deveIncrementarReplanejamento`), o adapter só persiste. */
  definirDataPlanejada(
    chamadoId: string,
    dataPlanejada: string,
    incrementarReplanejamento: boolean,
    userId: string,
  ): Promise<void>;
  /** E01-S101 AC-4: marca a execução real — SLA conta `createdAt` → esta data. */
  marcarExecucao(chamadoId: string, dataExecucao: string, userId: string): Promise<void>;
}
