import { requireServiceRole } from "../auth.ts";
import { criarHandlerT24 } from "./http-t24.ts";
import { processarLoteT24 } from "./lote-t24.ts";
import type { TransporteT24 } from "./fornecedor-t24.ts";
import type { RpcT24 } from "./repositorio-t24.ts";

type RespostaRpc = { data: unknown; error: unknown };
type ChamadaRpc = { abortSignal(signal: AbortSignal): PromiseLike<RespostaRpc> };
type Banco = { schema(nome: "pcm"): { rpc(nome: string, parametros: Record<string, unknown>): ChamadaRpc } };
type Dependencias = {
  habilitado: () => boolean;
  banco: Banco;
  criarTransporte: () => TransporteT24;
  agora: () => number;
};

const chamadasPermitidas = new Set([
  "sso_t24_reservar_candidata",
  "sso_t24_iniciar_efeito",
  "sso_t24_resultado_outbox_servico",
  "sso_t24_confirmar_efeito",
  "sso_t24_registrar_resposta_tardia",
]);

/** Uma tentativa por chamada: falha ou cancelamento não comprova rollback. */
function criarRpc(banco: Banco): RpcT24 {
  return async (nome, parametros) => {
    if (!chamadasPermitidas.has(nome)) throw new Error("RPC T24 não permitida.");
    const controlador = new AbortController();
    let prazo: ReturnType<typeof setTimeout> | undefined;
    const expiracao = new Promise<never>((_, rejeitar) => {
      prazo = setTimeout(() => {
        controlador.abort();
        rejeitar(new Error("Prazo da RPC T24 excedido; resultado não confirmado."));
      }, 15_000);
    });
    try {
      const chamada = banco.schema("pcm").rpc(nome, parametros).abortSignal(controlador.signal);
      const { data, error } = await Promise.race([chamada, expiracao]);
      if (error) throw new Error("RPC T24 indisponível ou resultado não confirmado.");
      return data;
    } finally {
      if (prazo !== undefined) clearTimeout(prazo);
    }
  };
}

/** Não registra função HTTP nem cria cliente, credenciais ou agendamento. */
export function criarComposicaoT24(d: Dependencias): (req: Request) => Promise<Response> {
  const handler = criarHandlerT24({
    autorizar: async (req) => {
      if (d.habilitado() !== true) return false;
      requireServiceRole(req);
      return true;
    },
    executar: (entrada) => processarLoteT24(entrada, {
      rpc: criarRpc(d.banco), criarTransporte: d.criarTransporte, agora: d.agora,
    }),
  });
  return handler;
}
