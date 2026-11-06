import { processarOrigemCampo } from "./processar-origem-campo.ts";
import type { ContratoOrigemCampo } from "./projecao-origem-campo.ts";

type Resposta = { data: unknown; error: unknown };
type Banco = { schema(nome: "pcm"): { rpc(nome: "sso_ler_envelope_contrato_origem" | "sso_processar_tarefa_campo_atomica" | "sso_registrar_evento_origem" | "sso_aplicar_evento_origem_campo", parametros: Record<string, unknown>): PromiseLike<Resposta> } };
const objeto = (valor: unknown): valor is Record<string, unknown> => !!valor && typeof valor === "object" && !Array.isArray(valor);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Não configura prova, credenciais, rota, cron ou EXECUTE de banco. */
export function criarProcessadorOrigemSupabase(db: Banco, comprovarContrato: (contrato: Readonly<Record<string, unknown>>) => Promise<boolean>, aplicarEventos = false) {
  return async (envelopeId: string, contratoId: string) => {
    if (!uuid.test(envelopeId) || !uuid.test(contratoId)) throw new Error("Identidade inválida.");
    const { data, error } = await db.schema("pcm").rpc("sso_ler_envelope_contrato_origem", { p_envelope_id: envelopeId, p_contrato_id: contratoId });
    if (error || !objeto(data) || !objeto(data.envelope) || !objeto(data.contrato)) throw new Error("Fonte indisponível.");
    const e = data.envelope, c = data.contrato;
    if (e.id !== envelopeId || c.id !== contratoId || typeof e.taskId !== "string" || !/^[1-9]\d{0,17}$/.test(e.taskId) ||
      !(e.clienteExternoId === null || typeof e.clienteExternoId === "string") || !objeto(e.payload) || c.habilitado !== true ||
      typeof c.versao !== "string" || typeof c.fuso !== "string" || !objeto(c.campos) || !objeto(c.estados)) throw new Error("Fonte divergente.");
    // Habilitação administrativa é uma declaração; prova independente é obrigatória.
    if (await comprovarContrato(Object.freeze({ ...c })) !== true) return { estado: "pendente", motivo: "contrato_nao_comprovado", envelopeId, eventoAplicado: false };
    const contrato = { id: contratoId, versao: c.versao, comprovado: true, fuso: c.fuso, campos: c.campos, estados: c.estados } as ContratoOrigemCampo;
    const envelope = { id: envelopeId, taskId: e.taskId, clienteExternoId: e.clienteExternoId as string | null, payload: e.payload };
    return processarOrigemCampo(envelopeId, {
      lerEnvelope: async () => envelope,
      lerContrato: async () => contrato,
      processar: (parametros) => db.schema("pcm").rpc("sso_processar_tarefa_campo_atomica", parametros),
      registrarEvento: (parametros) => db.schema("pcm").rpc("sso_registrar_evento_origem", parametros),
      ...(aplicarEventos ? { aplicarEvento: (parametros: { p_envelope_id: string; p_ordem: string }) => db.schema("pcm").rpc("sso_aplicar_evento_origem_campo", parametros) } : {}),
    });
  };
}
