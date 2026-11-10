import { criarRecepcaoLevantamentoComSessao } from "./recepcao-levantamento-sessao.ts";
import { conferirLevantamentoEstruturado } from "./encaminhar-levantamento-estruturado.ts";

type Cliente = Parameters<typeof criarRecepcaoLevantamentoComSessao>[0];
type Dependencias = {
  habilitado: boolean;
  origens: readonly string[];
  autenticar: (authorization: string) => Promise<{ atorId: string; cliente: Cliente }>;
  limitar: (atorId: string) => Promise<boolean>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const objeto = (valor: unknown): valor is Record<string, unknown> => !!valor && typeof valor === "object" && !Array.isArray(valor);

async function lerCorpo(req: Request): Promise<unknown> {
  const maximo = 1_200_000;
  const tamanho = req.headers.get("content-length");
  if (tamanho !== null && (!/^\d+$/.test(tamanho) || Number(tamanho) > maximo)) throw new Error("corpo_invalido");
  if (!req.body) throw new Error("corpo_invalido");
  const leitor = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  let concluido = false;
  let prazo: ReturnType<typeof setTimeout> | undefined;
  const expiracao = new Promise<never>((_, rejeitar) => { prazo = setTimeout(() => rejeitar(new Error("prazo_leitura")), 10_000); });
  try {
    while (true) {
      if (req.signal.aborted) throw new Error("leitura_interrompida");
      const parte = await Promise.race([leitor.read(), expiracao]);
      if (parte.done) { concluido = true; break; }
      total += parte.value.byteLength;
      if (total > maximo) throw new Error("corpo_invalido");
      partes.push(parte.value);
    }
  } finally {
    if (prazo !== undefined) clearTimeout(prazo);
    if (!concluido) void leitor.cancel().catch(() => {});
    try { leitor.releaseLock(); } catch { /* Leitura pode continuar em voo. */ }
  }
  const bytes = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) { bytes.set(parte, posicao); posicao += parte.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

/** Não provisiona credenciais, registra rota ou comprova a origem do levantamento. */
export function criarBordaLevantamentoEstruturado(d: Dependencias): (req: Request) => Promise<Response> {
  const origens = new Set(d.origens);
  return async (req) => {
    const origem = req.headers.get("origin");
    const permitida = origem !== null && origens.has(origem);
    const responder = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff",
        ...(permitida ? { "access-control-allow-origin": origem!, "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "POST, OPTIONS", vary: "Origin" } : {}) },
    });
    if (!d.habilitado || !permitida) return responder(503, { erro: "recepcao_indisponivel" });
    if (req.method === "OPTIONS") return responder(200, {});
    if (req.method !== "POST") return responder(405, { erro: "metodo_nao_permitido" });
    const authorization = req.headers.get("authorization") ?? "";
    if (!/^Bearer [^\s]+$/i.test(authorization)) return responder(401, { erro: "nao_autenticado" });
    let sessao: { atorId: string; cliente: Cliente };
    try {
      sessao = await d.autenticar(authorization);
      if (!uuid.test(sessao.atorId)) throw new Error();
      if (await d.limitar(sessao.atorId) !== true) return responder(429, { erro: "limite_excedido" });
    } catch { return responder(503, { erro: "autenticacao_ou_limite_indisponivel" }); }
    let corpo: unknown;
    try { corpo = await lerCorpo(req); } catch { return responder(400, { erro: "corpo_invalido" }); }
    if (!objeto(corpo) || !["confirmado,contexto,contrato,entrada", "acao,confirmado,contexto,contrato,entrada"].includes(Object.keys(corpo).sort().join(",")) ||
      (corpo.acao !== undefined && corpo.acao !== "consultar" && corpo.acao !== "prever") || corpo.confirmado !== true || !objeto(corpo.contexto))
      return responder(422, { erro: "pedido_invalido" });
    const c = corpo.contexto;
    if (Object.keys(c).sort().join(",") !== "clienteId,envelopeId,osId,requestId,taskId" ||
      ![c.clienteId, c.envelopeId, c.osId, c.requestId].every((id) => typeof id === "string" && uuid.test(id)) ||
      typeof c.taskId !== "string" || !/^[1-9]\d{0,18}$/.test(c.taskId)) return responder(422, { erro: "contexto_invalido" });
    try {
      const contexto = { atorId: sessao.atorId,
        clienteId: c.clienteId as string, envelopeId: c.envelopeId as string, osId: c.osId as string,
        requestId: c.requestId as string, taskId: c.taskId };
      if (corpo.acao === "prever") {
        const previa = conferirLevantamentoEstruturado(contexto, corpo.entrada, corpo.contrato);
        return responder(previa.estado === "preparado" ? 200 : 422, previa);
      }
      const resultado = await criarRecepcaoLevantamentoComSessao(sessao.cliente)(contexto, corpo.entrada, corpo.contrato, corpo.acao === "consultar" ? "consultar" : "receber");
      return responder(resultado.estado === "pendente" ? 422 : 200, resultado);
    } catch { return responder(503, { erro: "resultado_nao_confirmado", requestId: c.requestId }); }
  };
}
