type Resposta = { data: unknown; error: unknown };
type Banco = { schema(nome: "pcm"): { rpc(nome: "sso_receber_envelope_origem_campo" | "sso_resolver_envelope_origem_idempotente", parametros: Record<string, unknown>): PromiseLike<Resposta> } };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Canonicaliza apenas JSON; não interpreta conteúdo ou ordem de eventos. */
function canonico(valor: unknown, profundidade = 0): string {
  if (profundidade > 50) throw new Error("Envelope excede profundidade.");
  if (valor === null || typeof valor === "string" || typeof valor === "boolean") return JSON.stringify(valor);
  if (typeof valor === "number" && Number.isFinite(valor)) return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map((v) => canonico(v, profundidade + 1)).join(",")}]`;
  if (typeof valor === "object") {
    const item = valor as Record<string, unknown>;
    return `{${Object.keys(item).sort().map((chave) => `${JSON.stringify(chave)}:${canonico(item[chave], profundidade + 1)}`).join(",")}}`;
  }
  throw new Error("Envelope não é JSON.");
}

/** Somente registra entrada; não cria OS, não aplica evento e não confirma origem operacional. */
export async function capturarEnvelopeCampo(db: Banco, entrada: { taskId: number; clienteExternoId: number | null; payload: unknown }) {
  if (!Number.isSafeInteger(entrada.taskId) || entrada.taskId < 1 ||
    (entrada.clienteExternoId !== null && (!Number.isSafeInteger(entrada.clienteExternoId) || entrada.clienteExternoId < 1)) ||
    !entrada.payload || typeof entrada.payload !== "object" || Array.isArray(entrada.payload)) throw new Error("Envelope inválido.");
  const serializado = canonico(entrada.payload);
  const bytes = new TextEncoder().encode(serializado);
  // Margem para espaços e codificação de jsonb::text no servidor.
  if (bytes.length > 196_608) throw new Error("Envelope excede limite.");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data, error } = await db.schema("pcm").rpc("sso_receber_envelope_origem_campo", {
    p_integracao: "auvo", p_task_id: entrada.taskId, p_chave_evento: `payload-sha256:${hash}`,
    p_cliente_externo_id: entrada.clienteExternoId === null ? null : String(entrada.clienteExternoId),
    p_ocorrido_em: null, p_payload: entrada.payload,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("Captura não confirmada.");
  const r = data as Record<string, unknown>;
  if (typeof r.envelopeId !== "string" || !uuid.test(r.envelopeId) || typeof r.criado !== "boolean" || r.estado !== "pendente")
    throw new Error("Recibo de captura inválido.");
  return { envelopeId: r.envelopeId, criado: r.criado };
}

export async function resolverEnvelopeCampo(db: Banco, envelopeId: string) {
  if (!uuid.test(envelopeId)) throw new Error("Envelope inválido.");
  const { data, error } = await db.schema("pcm").rpc("sso_resolver_envelope_origem_idempotente", { p_envelope_id: envelopeId });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("Resolução não confirmada.");
  const r = data as Record<string, unknown>;
  if (r.envelopeId !== envelopeId || typeof r.resolucaoId !== "string" || !uuid.test(r.resolucaoId) ||
    !["os_identificada", "cliente_desconhecido", "os_nao_encontrada", "cliente_divergente"].includes(String(r.resultado)) ||
    r.eventoAplicado !== false || typeof r.reutilizada !== "boolean") throw new Error("Recibo de resolução inválido.");
  return { resultado: r.resultado, reutilizada: r.reutilizada };
}
