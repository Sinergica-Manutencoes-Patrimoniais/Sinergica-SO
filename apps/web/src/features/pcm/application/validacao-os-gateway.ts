import type { PerguntaRetorno, RespostaPergunta } from "../domain/validacao-os";

export interface RetornoClassificavel {
  envelopeId: string;
  resolucaoId: string;
  osId: string;
  taskId: string;
  ocorridoEm: string;
  recebidoEm: string;
  perguntas: PerguntaRetorno[];
}
export interface ConsultaRetornosClassificaveis {
  clienteId: string;
  apos: string | null;
  limite: number;
}

export interface ClassificarRetorno {
  requestId: string;
  clienteId: string;
  envelopeId: string;
  resolucaoId: string;
  retornoId: string;
  respostas: RespostaPergunta[];
}
export interface ResultadoClassificacao {
  requestId: string;
  retornoId: string;
  coberturaComprovada: false;
}

export interface ConferirCoberturaRetorno {
  requestId: string;
  clienteId: string;
  retornoId: string;
  evidenciaId: string | null;
  expectedEvidencias: number;
  justificativa: string;
}
export interface ResultadoConferenciaCobertura {
  conferenciaId: string;
  retornoId: string;
  requestId: string;
}

export interface ConferenciaCobertura {
  id: string;
  evidenciaId: string;
  revisaoEvidencias: number;
  perguntas: number;
  justificativa: string;
  atorId: string;
  criadoEm: string;
}
export interface ConsultaConferenciasCobertura {
  clienteId: string;
  retornoId: string;
  apos: string | null;
  limite: number;
}

export interface AprovarFinalizarOs {
  requestId: string;
  clienteId: string;
  retornoId: string;
  conferenciaId: string;
  expectedEvidencias: number;
  expectedDecisao: number;
  justificativa: string;
  expectedOsId: string;
  expectedStatus: string;
  expectedUpdatedAt: string;
}
export interface ResultadoAprovacaoFinalizacao {
  requestId: string;
  retornoId: string;
  osId: string;
  revision: number;
  pendenciasProcessadas: number;
  osEncerrada: true;
  chamadoAlterado: false;
  conteudoAutenticado: false;
}

/** Comandos reais por trás do AC-8 (validar execução no PCM). Núcleos privados
 * (`sso_classificar_retorno_campo_manual`/`sso_conferir_cobertura_retorno`/
 * `sso_atestar_aprovar_retorno_pcm`) continuam sem grant de propósito — tudo aqui passa pelas
 * versões "_mediada"/"_mediado" (1590/1597/1598), e a aprovação final sempre passa pelo comando
 * atômico `sso_aprovar_finalizar_os_atomico` (1566), que aprova e finaliza a OS na mesma transação
 * em vez de dois passos que poderiam divergir entre si. */
export interface ValidacaoOsGateway {
  listarRetornosClassificaveis(
    consulta: ConsultaRetornosClassificaveis,
    signal?: AbortSignal,
  ): Promise<RetornoClassificavel[]>;
  classificarRetorno(comando: ClassificarRetorno): Promise<ResultadoClassificacao>;
  listarConferenciasCobertura(
    consulta: ConsultaConferenciasCobertura,
    signal?: AbortSignal,
  ): Promise<ConferenciaCobertura[]>;
  conferirCoberturaRetorno(
    comando: ConferirCoberturaRetorno,
  ): Promise<ResultadoConferenciaCobertura>;
  aprovarFinalizarOs(comando: AprovarFinalizarOs): Promise<ResultadoAprovacaoFinalizacao>;
}
