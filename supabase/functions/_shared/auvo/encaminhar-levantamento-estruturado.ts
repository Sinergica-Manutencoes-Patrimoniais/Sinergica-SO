import { prepararLevantamentoEstruturado } from "./levantamento-recepcao.ts";

type Contexto = {
  atorId: string;
  clienteId: string;
  osId: string;
  envelopeId: string;
  taskId: string;
  requestId: string;
};
type Preparado = Extract<ReturnType<typeof prepararLevantamentoEstruturado>, { estado: "preparado" }>;
type Preparacao = ReturnType<typeof prepararLevantamentoEstruturado> | { estado: "pendente"; motivo: "contexto_invalido" | "origem_divergente" };
type PortaRecepcao = (pedido: {
  atorId: string;
  clienteId: string;
  osId: string;
  envelopeId: string;
  requestId: string;
  linhas: Preparado["linhas"];
  fotos: Preparado["fotos"];
}) => Promise<unknown>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mesmaIdentidade = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Conferência determinística sem persistência ou alegação de origem. */
export function conferirLevantamentoEstruturado(
  contexto: Contexto,
  entrada: unknown,
  contrato: unknown,
): Preparacao {
  if (!contexto || ![contexto.atorId, contexto.clienteId, contexto.osId, contexto.envelopeId, contexto.requestId].every((id) => typeof id === "string" && uuid.test(id)) ||
    typeof contexto.taskId !== "string" || !/^[1-9]\d{0,18}$/.test(contexto.taskId))
    return { estado: "pendente", motivo: "contexto_invalido" };
  const preparado = prepararLevantamentoEstruturado(entrada, contrato);
  if (preparado.estado === "pendente") return preparado;
  if (!mesmaIdentidade(preparado.origem.clienteId, contexto.clienteId) ||
    !mesmaIdentidade(preparado.origem.osId, contexto.osId) ||
    !mesmaIdentidade(preparado.origem.envelopeId, contexto.envelopeId) ||
    preparado.origem.taskId !== contexto.taskId)
    return { estado: "pendente", motivo: "origem_divergente" };
  return preparado;
}

/** A porta deve usar a sessão atual do ator; esta função não comprova origem Auvo. */
export async function encaminharLevantamentoEstruturado(
  contexto: Contexto,
  entrada: unknown,
  contrato: unknown,
  receber: PortaRecepcao,
): Promise<
  | { estado: "pendente"; motivo: string }
  | { estado: "recebido"; requestId: string; loteId: string; origemComprovada: false; fotosImportadas: false; cadastrosIncorporados: false }
> {
  const preparado = conferirLevantamentoEstruturado(contexto, entrada, contrato);
  if (preparado.estado !== "preparado") return preparado;
  // Erro de transporte é propagado: pode ter havido commit e o chamador deve
  // recuperar ou repetir exatamente o mesmo pedido, nunca presumir rollback.
  const resposta = await receber({
    atorId: contexto.atorId, clienteId: contexto.clienteId, osId: contexto.osId,
    envelopeId: contexto.envelopeId, requestId: contexto.requestId,
    linhas: preparado.linhas, fotos: preparado.fotos,
  });
  if (!resposta || typeof resposta !== "object" || Array.isArray(resposta)) throw new Error("Recibo não confirmado.");
  const r = resposta as Record<string, unknown>;
  if (typeof r.requestId !== "string" || !mesmaIdentidade(r.requestId, contexto.requestId) ||
    typeof r.envelopeId !== "string" || !mesmaIdentidade(r.envelopeId, contexto.envelopeId) ||
    typeof r.loteId !== "string" || !uuid.test(r.loteId) || r.estado !== "pendente" ||
    r.origemComprovada !== false || r.fotosImportadas !== false || r.cadastrosIncorporados !== false)
    throw new Error("Recibo não confirmado.");
  return { estado: "recebido", requestId: contexto.requestId, loteId: r.loteId,
    origemComprovada: false, fotosImportadas: false, cadastrosIncorporados: false };
}
