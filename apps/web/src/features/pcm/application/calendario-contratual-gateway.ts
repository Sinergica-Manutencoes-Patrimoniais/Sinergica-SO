export interface CriarRegraContratualCommand {
  requestId: string;
  expectedRevision: number;
  clienteId: string;
  serieId: string;
  regraId: string;
  contratoId: string;
  ancoraSemana: string;
  diaSemana: number;
  intervaloSemanas: number;
  horaInicio: string;
  duracaoMinutos: number;
  deslocamentoMinutos: number;
  fuso: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
}
export interface ResultadoRegraContratual {
  aggregateId: string;
  revision: number;
  state: string;
  created: boolean;
  linkedIds: Record<string, string>;
  warnings: string[];
  requestId: string;
}
export interface CriarRegraContratualGateway {
  criarRegra(comando: CriarRegraContratualCommand): Promise<ResultadoRegraContratual>;
}
export interface ContratoCalendario {
  id: string;
  tipo: "residente" | "volante" | "avulso";
  status: "rascunho" | "ativo" | "suspenso" | "encerrado";
  vigenciaInicio: string;
  vigenciaFim: string | null;
}
export interface ConsultarContratosCalendarioGateway {
  listarContratos(
    clienteId: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ): Promise<ContratoCalendario[]>;
}
export interface RegraContratualResumo {
  id: string;
  serieId: string;
  contratoId: string;
  numero: number;
  ancoraSemana: string;
  diaSemana: number;
  intervaloSemanas: number;
  horaInicio: string;
  duracaoMinutos: number;
  deslocamentoMinutos: number;
  fuso: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
}
export interface ConsultarRegrasCalendarioGateway {
  listarRegras(
    clienteId: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ): Promise<RegraContratualResumo[]>;
}
