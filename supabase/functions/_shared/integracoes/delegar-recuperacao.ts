import { planejarRecuperacao, type ConsultaCandidatos, type PlanoRecuperacao } from "./reconciliar.ts";
import type { ResultadoTentativa } from "./politica-recuperacao.ts";

export type IdentidadeRecuperacao = { clienteId: string; origemId: string; versaoOrigem: number; requestId: string };
export type SolicitacaoProprietario = IdentidadeRecuperacao & { naoAntesDeMs: number };
export type ResultadoProprietario =
  | { estado: "aceito"; protocolo: string }
  | { estado: "recusado"; motivo: string }
  | { estado: "incerto" };
type Dependencias = {
  consultar: (identidade: IdentidadeRecuperacao) => Promise<ConsultaCandidatos>;
  /** agoraMs da tentativa é o instante de referência estável da falha, não a hora atual. */
  tentativa: (identidade: IdentidadeRecuperacao) => Promise<ResultadoTentativa>;
  agora: () => number;
  /** O proprietário deve revalidar fatos e usar requestId idempotente antes de qualquer efeito. */
  delegarAoProprietario: (solicitacao: SolicitacaoProprietario) => Promise<ResultadoProprietario>;
};
export type ResultadoDelegacao =
  | { estado: "nao_delegado"; plano: PlanoRecuperacao }
  | { estado: "aguardando"; naoAntesDeMs: number }
  | { estado: "delegado"; protocolo: string }
  | { estado: "recusado"; motivo: string }
  | { estado: "incerto" };

async function aguardarProprietario(operacao: Promise<ResultadoProprietario>): Promise<ResultadoProprietario> {
  let prazo: ReturnType<typeof setTimeout> | undefined;
  const expiracao = new Promise<ResultadoProprietario>((resolver) => {
    prazo = setTimeout(() => resolver({ estado: "incerto" }), 15_000);
  });
  try {
    // O proprietário deve manter o requestId para consulta se concluir depois.
    return await Promise.race([operacao, expiracao]);
  } finally {
    if (prazo !== undefined) clearTimeout(prazo);
  }
}

async function aguardarLeitura<T>(operacao: Promise<T>): Promise<T> {
  let prazo: ReturnType<typeof setTimeout> | undefined;
  const expiracao = new Promise<never>((_, rejeitar) => {
    prazo = setTimeout(() => rejeitar(new Error("Prazo de leitura excedido.")), 15_000);
  });
  try { return await Promise.race([operacao, expiracao]); }
  finally { if (prazo !== undefined) clearTimeout(prazo); }
}

/**
 * Orquestra somente por dependências explícitas. Não fornece adaptador de rede
 * nem persiste resultados; uma resposta perdida deve ser reconciliada pelo
 * proprietário com o mesmo requestId, jamais por criação de outro pedido.
 */
export async function delegarRecuperacao(
  entrada: IdentidadeRecuperacao,
  dependencias: Dependencias,
): Promise<ResultadoDelegacao> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(entrada.clienteId) || !uuid.test(entrada.requestId) ||
    typeof entrada.origemId !== "string" || !entrada.origemId.trim() || entrada.origemId.length > 200 || entrada.origemId !== entrada.origemId.trim() ||
    !Number.isSafeInteger(entrada.versaoOrigem) || entrada.versaoOrigem < 1)
    throw new Error("Identidade de recuperação inválida.");
  const identidade = { ...entrada };
  let consulta: ConsultaCandidatos;
  let tentativa: ResultadoTentativa;
  try {
    [consulta, tentativa] = await Promise.all([
      aguardarLeitura(dependencias.consultar(identidade)),
      aguardarLeitura(dependencias.tentativa(identidade)),
    ]);
  } catch {
    return { estado: "nao_delegado", plano: { acao: "consultar_novamente" } };
  }
  const plano = planejarRecuperacao(identidade, consulta, tentativa);
  if (plano.acao !== "delegar_retry") return { estado: "nao_delegado", plano };
  const agora = dependencias.agora();
  if (!Number.isSafeInteger(agora) || agora < tentativa.agoraMs) throw new Error("Relógio de recuperação inválido.");
  if (plano.naoAntesDeMs > agora) return { estado: "aguardando", naoAntesDeMs: plano.naoAntesDeMs };
  try {
    const resultado = await aguardarProprietario(dependencias.delegarAoProprietario({ ...identidade, naoAntesDeMs: plano.naoAntesDeMs }));
    if (resultado?.estado === "aceito" && typeof resultado.protocolo === "string" && resultado.protocolo.trim())
      return { estado: "delegado", protocolo: resultado.protocolo };
    if (resultado?.estado === "recusado" && typeof resultado.motivo === "string" && resultado.motivo.trim())
      return { estado: "recusado", motivo: resultado.motivo };
    return { estado: "incerto" };
  } catch {
    return { estado: "incerto" };
  }
}
