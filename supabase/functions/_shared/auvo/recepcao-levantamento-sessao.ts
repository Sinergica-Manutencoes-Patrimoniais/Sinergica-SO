import { encaminharLevantamentoEstruturado } from "./encaminhar-levantamento-estruturado.ts";

type Contexto = Parameters<typeof encaminharLevantamentoEstruturado>[0];
type ResultadoSessao = { data: { user: { id: string } | null }; error: unknown };
type ResultadoRpc = { data: unknown; error: unknown };
type ClienteAutenticado = {
  auth: { getUser(): PromiseLike<ResultadoSessao> };
  schema(nome: "pcm"): {
    rpc(nome: "sso_receber_envelope_campo_mediada" | "sso_consultar_recepcao_envelope_mediada", parametros: Record<string, unknown>): PromiseLike<ResultadoRpc>;
  };
};

/** Sem credenciais próprias: o cliente deve carregar a sessão autenticada do ator. */
export function criarRecepcaoLevantamentoComSessao(cliente: ClienteAutenticado) {
  return async (contexto: Contexto, entrada: unknown, contrato: unknown, acao: "receber" | "consultar" = "receber") => {
    const conferirSessao = async () => {
      const { data, error } = await cliente.auth.getUser();
      if (error || !data.user || data.user.id.toLowerCase() !== contexto.atorId.toLowerCase())
        throw new Error("Sessão indisponível ou alterada.");
    };
    await conferirSessao();
    return encaminharLevantamentoEstruturado(contexto, entrada, contrato, async (pedido) => {
      await conferirSessao();
      const { data, error } = await cliente.schema("pcm").rpc(acao === "consultar" ? "sso_consultar_recepcao_envelope_mediada" : "sso_receber_envelope_campo_mediada", {
        p_ator_id: pedido.atorId, p_cliente_id: pedido.clienteId, p_os_id: pedido.osId,
        p_envelope_id: pedido.envelopeId, p_request_id: pedido.requestId,
        p_linhas: pedido.linhas, p_fotos: pedido.fotos,
      });
      if (error) throw new Error("Recepção não confirmada.");
      // Se a sessão mudar depois do commit, manter o pedido para reconciliação.
      await conferirSessao();
      return data;
    });
  };
}
