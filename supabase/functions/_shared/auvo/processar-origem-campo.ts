import { projetarOrigemCampo, type ContratoOrigemCampo } from "./projecao-origem-campo.ts";

type Envelope = { id: string; taskId: string; clienteExternoId: string | null; payload: unknown };
type Resposta = { data: unknown; error: unknown };
type Porta = {
  lerEnvelope: (id: string) => Promise<Envelope | null>;
  lerContrato: (envelope: Envelope) => Promise<ContratoOrigemCampo | null>;
  processar: (parametros: { p_envelope_id: string; p_contrato_id: string; p_projecao: unknown }) => PromiseLike<Resposta>;
  registrarEvento: (parametros: { p_envelope_id: string; p_contrato_id: string; p_projecao: unknown }) => PromiseLike<Resposta>;
  aplicarEvento?: (parametros: { p_envelope_id: string; p_ordem: string }) => PromiseLike<Resposta>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** As portas de leitura devem obter o envelope persistido e o contrato aprovado de fonte protegida. */
export async function processarOrigemCampo(envelopeId: string, porta: Porta): Promise<unknown> {
  if (!uuid.test(envelopeId)) throw new Error("Envelope inválido.");
  const envelope = await porta.lerEnvelope(envelopeId);
  if (!envelope || envelope.id.toLowerCase() !== envelopeId.toLowerCase()) throw new Error("Envelope indisponível.");
  const contrato = await porta.lerContrato(envelope);
  if (!contrato) return { estado: "pendente", motivo: "contrato_indisponivel", envelopeId, eventoAplicado: false };
  const preparado = projetarOrigemCampo({ payload: envelope.payload, taskId: envelope.taskId, clienteExternoId: envelope.clienteExternoId, contrato });
  if (preparado.estado === "pendente") return { ...preparado, envelopeId, eventoAplicado: false };
  // Falha da RPC não comprova rollback; consultar ou repetir o mesmo envelope.
  const { data, error } = await porta.processar({ p_envelope_id: envelopeId, p_contrato_id: preparado.contratoId, p_projecao: preparado.projecao });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("Processamento não confirmado.");
  const r = data as Record<string, unknown>;
  if (r.envelopeId !== envelopeId || !["pendente", "processado"].includes(String(r.estado)) || typeof r.eventoAplicado !== "boolean")
    throw new Error("Recibo de processamento inválido.");
  if (r.estado === "pendente" && (r.eventoAplicado !== false || typeof r.motivo !== "string")) throw new Error("Recibo de processamento inválido.");
  if (r.estado === "processado" && (typeof r.clienteId !== "string" || !uuid.test(r.clienteId) || typeof r.chamadoId !== "string" || !uuid.test(r.chamadoId) ||
    typeof r.osId !== "string" || !uuid.test(r.osId) || r.taskId !== envelope.taskId || r.validacaoPcmComprovada !== false || r.fotosImportadas !== false ||
    typeof r.reutilizado !== "boolean" || (r.reutilizado === true && r.eventoAplicado !== false) ||
    (r.reutilizado === false && r.eventoAplicado === false && !["os_existente", "os_externa_identificada"].includes(String(r.motivo))))) throw new Error("Recibo de processamento inválido.");
  if (r.estado === "processado" && r.reutilizado === false && r.eventoAplicado === false)
    return { ...r, estado: "pendente", motivo: "os_preexistente_exige_conferencia" };
  if (r.estado === "processado" && r.reutilizado === true) {
    const evento = await porta.registrarEvento({ p_envelope_id: envelopeId, p_contrato_id: preparado.contratoId, p_projecao: preparado.projecao });
    if (evento.error || !evento.data || typeof evento.data !== "object" || Array.isArray(evento.data)) throw new Error("Registro do evento não confirmado.");
    const v = evento.data as Record<string, unknown>;
    if (v.envelopeId !== envelopeId || v.osId !== r.osId || !["aceito", "atrasado", "conflito_regressao", "conflito"].includes(String(v.estado))) throw new Error("Recibo do evento inválido.");
    if (v.estado === "aceito" && porta.aplicarEvento) {
      if (typeof v.ordemExterna !== "string" || !/^[1-9]\d{0,17}$/.test(v.ordemExterna)) throw new Error("Ordem do evento inválida.");
      // Registro e aplicação são transações separadas; um timeout exige repetir o mesmo envelope.
      const aplicacao = await porta.aplicarEvento({ p_envelope_id: envelopeId, p_ordem: v.ordemExterna });
      if (aplicacao.error || !aplicacao.data || typeof aplicacao.data !== "object" || Array.isArray(aplicacao.data)) throw new Error("Aplicação não confirmada.");
      const a = aplicacao.data as Record<string, unknown>;
      if (a.envelopeId !== envelopeId || a.ordemExterna !== v.ordemExterna || !["aplicado", "ja_contemplado", "pendente"].includes(String(a.estado)) ||
        (["aplicado", "ja_contemplado"].includes(String(a.estado)) && (a.osId !== r.osId || a.clienteId !== r.clienteId || a.validacaoPcmComprovada !== false || a.chamadoAlterado !== false)) ||
        (a.estado === "aplicado" && (typeof a.statusAlterado !== "boolean" || typeof a.statusOperacional !== "string")) ||
        (a.estado === "pendente" && typeof a.motivo !== "string")) throw new Error("Recibo da aplicação inválido.");
      return { ...r, evento: v, aplicacao: a };
    }
    return { ...r, evento: v };
  }
  return r;
}
