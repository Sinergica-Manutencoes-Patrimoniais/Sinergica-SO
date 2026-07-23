import type { HistoricoChamadoSnapshot, MensagemSnapshot } from "../domain/historico-chamado";

/** E01-S89 AC-2: leitura mínima de `pcm.chamados` — Atendimento é Conformist do PCM aqui (mesmo
 * padrão de `FinanceiroGateway.listarClientesOpcoes`, lê `pcm.clientes` sem importar `features/pcm`).
 * Nunca importa código de `features/pcm/` — só lê/escreve a tabela direto via `.schema("pcm")`. */
export interface ChamadoOpcao {
  id: string;
  numero: string;
  titulo: string;
  status: string;
}

export interface HistoricoChamadoGateway {
  listarChamadosDoCliente(clienteId: string): Promise<ChamadoOpcao[]>;
  /** AC-2: "criar um novo na hora" — só funciona se o usuário também tiver `pcm:escrita` (RLS de
   * `pcm.chamados` exige isso; o gate de UI reflete essa realidade, não é regra arbitrária). */
  criarChamadoRapido(clienteId: string, titulo: string, userId: string): Promise<ChamadoOpcao>;
  listarMensagensDaJanela(
    conversaId: string,
    dataInicio: string,
    dataFim: string,
  ): Promise<MensagemSnapshot[]>;
  salvarSnapshot(input: {
    conversaId: string;
    chamadoId: string;
    janelaDias: number;
    dataInicio: string;
    dataFim: string;
    mensagens: MensagemSnapshot[];
    userId: string;
  }): Promise<HistoricoChamadoSnapshot>;
  /** Exibido no detalhe do Chamado (PCM) — mesma tabela, mesma direção Conformist. */
  listarSnapshotsDoChamado(chamadoId: string): Promise<HistoricoChamadoSnapshot[]>;
}
