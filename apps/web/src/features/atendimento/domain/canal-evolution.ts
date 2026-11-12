/**
 * E02-S35 — Estado, saúde e transições do canal Evolution (ADR-1686).
 *
 * Substitui `status_conexao` ('conectado'|'desconectado'|'erro') por um estado mais fino, que
 * distingue "nunca configurado" de "instância criada mas webhook falhou" de "desconectado com
 * credencial anterior" — a UI precisa saber qual ação oferecer em cada caso (AC-5, AC-6, AC-8).
 *
 * `status_conexao` legado continua existindo no banco, sincronizado por trigger, até todos os
 * consumidores migrarem para `estado_conexao`.
 */

export type EstadoDoCanal =
  | "sem_credencial"
  | "configurado"
  | "configuracao_incompleta"
  | "aguardando_pareamento"
  | "conectado_verificado"
  | "desconectado";

export type SaudeDoCanal = "desconhecida" | "saudavel" | "degradada";

export interface CanalEvolution {
  id: string;
  estado: EstadoDoCanal;
  saude: SaudeDoCanal;
  credencialRef: string | null;
  ultimoSucessoEm: string | null;
  ultimoErroEm: string | null;
}

export class CredencialInvalida extends Error {
  constructor() {
    super("Referência de credencial é obrigatória para salvar no canal.");
  }
}

export class TransicaoDeEstadoInvalida extends Error {
  constructor() {
    super("Canal precisa de credencial configurada antes de ser marcado como conectado.");
  }
}

/**
 * Credencial salva nunca equivale a conectado (AC-6): o estado volta a `configurado`, pendente de
 * verificação real, mesmo que o canal já estivesse conectado antes.
 */
export function salvarCredencial(canal: CanalEvolution, credencialRef: string): CanalEvolution {
  const ref = credencialRef.trim();
  if (ref === "") throw new CredencialInvalida();
  return { ...canal, credencialRef: ref, estado: "configurado" };
}

export function marcarConectado(canal: CanalEvolution): CanalEvolution {
  if (canal.credencialRef === null || canal.estado === "sem_credencial") {
    throw new TransicaoDeEstadoInvalida();
  }
  return { ...canal, estado: "conectado_verificado" };
}

/** Desconectar é reversível: a credencial permanece para permitir reconectar (AC-8). */
export function marcarDesconectado(canal: CanalEvolution): CanalEvolution {
  return { ...canal, estado: "desconectado" };
}

export function marcarConfiguracaoIncompleta(canal: CanalEvolution): CanalEvolution {
  return { ...canal, estado: "configuracao_incompleta" };
}

/** Saúde reflete o uso real — nunca um selo verde permanente (AC-7). */
export function registrarSucesso(canal: CanalEvolution, quando: string): CanalEvolution {
  return { ...canal, saude: "saudavel", ultimoSucessoEm: quando };
}

export function registrarErro(canal: CanalEvolution, quando: string): CanalEvolution {
  return { ...canal, saude: "degradada", ultimoErroEm: quando };
}

/**
 * Falha de autenticação desconecta o canal automaticamente, sem esperar alguém investigar primeiro
 * (AC-7). Outras falhas só degradam a saúde — ver `registrarErro`.
 */
export function marcarSessaoCaida(canal: CanalEvolution, quando: string): CanalEvolution {
  return marcarDesconectado(registrarErro(canal, quando));
}

/**
 * Canal que já teve credencial válida só precisa reescanear o QR — não voltar à configuração do
 * zero. Sem credencial anterior, a ação certa é configurar (AC-8).
 */
export function precisaReescanear(canal: CanalEvolution): boolean {
  return canal.estado === "desconectado" && canal.credencialRef !== null;
}
