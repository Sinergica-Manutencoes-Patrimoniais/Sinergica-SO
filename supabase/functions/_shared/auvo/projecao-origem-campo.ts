import { horarioAuvoParaUtc } from "./horario-t24.ts";

type Campos = {
  taskId: string; clienteId: string; titulo: string; status: string; ordem: string;
  descricao?: string; osExternaId?: string; chamadoId?: string; tecnicoId?: string;
  dataAgendada?: string; checkIn?: string; checkOut?: string; detalhes?: string;
};
export type ContratoOrigemCampo = {
  id: string; versao: string; comprovado: boolean; fuso: string; campos: Campos;
  estados: Record<string, "aberta" | "em_andamento" | "concluida">;
};
type Projecao = {
  titulo: string; descricao: string | null; statusCampo: "aberta" | "em_andamento" | "concluida";
  osExternaId: string | null; chamadoId: string | null; tecnicoAuvoId: string | null;
  referenciaInvalida: boolean;
  ordemExterna: string;
  dataAgendada: string | null; checkIn: string | null; checkOut: string | null;
  detalhes: Record<string, unknown> | null;
};
type Resultado = { estado: "pendente"; motivo: string } | { estado: "preparado"; contratoId: string; projecao: Projecao };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const campoValido = (valor: unknown): valor is string => typeof valor === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(valor);
const objeto = (valor: unknown): valor is Record<string, unknown> => !!valor && typeof valor === "object" && !Array.isArray(valor);
const pendente = (motivo: string): Resultado => ({ estado: "pendente", motivo });
const identidade = (valor: unknown): string | null => {
  if (typeof valor === "number") return Number.isSafeInteger(valor) && valor > 0 ? String(valor) : null;
  if (typeof valor !== "string" || !/^[1-9]\d{0,17}$/.test(valor)) return null;
  return valor;
};

/** Somente mapeamento explícito: não autentica origem, contrato nem estado no servidor. */
export function projetarOrigemCampo(entrada: {
  payload: unknown; taskId: string; clienteExternoId: string | null; contrato: ContratoOrigemCampo;
}): Resultado {
  const c = entrada?.contrato;
  if (!c || c.comprovado !== true || !uuid.test(c.id) || typeof c.versao !== "string" || !c.versao.trim() || c.versao.length > 100 ||
    !objeto(c.campos) || !objeto(c.estados) || typeof c.fuso !== "string") return pendente("contrato_nao_comprovado");
  const nomes = Object.values(c.campos);
  const permitidos = ["taskId", "clienteId", "titulo", "status", "ordem", "descricao", "osExternaId", "chamadoId", "tecnicoId", "dataAgendada", "checkIn", "checkOut", "detalhes"];
  if (Object.keys(c.campos).some((chave) => !permitidos.includes(chave)) || nomes.some((nome) => !campoValido(nome)) ||
    new Set(nomes).size !== nomes.length || ![c.campos.taskId, c.campos.clienteId, c.campos.titulo, c.campos.status, c.campos.ordem].every(campoValido) ||
    !Object.keys(c.estados).length || Object.values(c.estados).some((estado) => !["aberta", "em_andamento", "concluida"].includes(estado)))
    return pendente("contrato_invalido");
  if (!objeto(entrada.payload) || !/^[1-9]\d{0,17}$/.test(entrada.taskId)) return pendente("envelope_invalido");
  const p = entrada.payload;
  const obter = (nome: string | undefined): unknown => nome === undefined ? null : Object.hasOwn(p, nome) ? p[nome] : null;
  if (identidade(obter(c.campos.taskId)) !== entrada.taskId) return pendente("tarefa_divergente");
  const ordemExterna = identidade(obter(c.campos.ordem));
  if (ordemExterna === null) return pendente("ordem_nao_comprovada");
  const cliente = obter(c.campos.clienteId);
  if ((cliente != null && identidade(cliente) === null) || (cliente == null ? null : identidade(cliente)) !== entrada.clienteExternoId) return pendente("cliente_divergente");
  const titulo = obter(c.campos.titulo), descricao = obter(c.campos.descricao), status = obter(c.campos.status);
  if (typeof titulo !== "string" || !titulo.trim() || titulo.trim().length > 200 ||
    (descricao !== null && (typeof descricao !== "string" || descricao.trim().length > 10000)) ||
    (typeof status !== "string" && (typeof status !== "number" || !Number.isSafeInteger(status)))) return pendente("campos_incompativeis");
  const chaveStatus = String(status);
  if (!Object.hasOwn(c.estados, chaveStatus)) return pendente("status_nao_mapeado");
  const statusCampo = c.estados[chaveStatus]!;
  const referencia = (nome: string | undefined): string | null | undefined => {
    const valor = obter(nome);
    if (valor == null || valor === "") return null;
    return typeof valor === "string" && uuid.test(valor) ? valor.toLowerCase() : undefined;
  };
  const osExternaId = referencia(c.campos.osExternaId), chamadoId = referencia(c.campos.chamadoId);
  const referenciaInvalida = osExternaId === undefined || chamadoId === undefined;
  const tecnicoBruto = obter(c.campos.tecnicoId);
  const tecnicoAuvoId = tecnicoBruto == null ? null : identidade(tecnicoBruto);
  if (tecnicoBruto != null && tecnicoAuvoId === null) return pendente("tecnico_invalido");
  const horario = (nome: string | undefined): string | null | undefined => {
    const valor = obter(nome);
    if (valor == null || valor === "") return null;
    if (typeof valor !== "string") return undefined;
    const convertido = horarioAuvoParaUtc(valor, c.fuso);
    return convertido.ok ? convertido.valor : undefined;
  };
  const dataAgendada = horario(c.campos.dataAgendada), checkIn = horario(c.campos.checkIn), checkOut = horario(c.campos.checkOut);
  if (dataAgendada === undefined || checkIn === undefined || checkOut === undefined ||
    (checkIn !== null && checkOut !== null && checkOut < checkIn)) return pendente("horario_invalido");
  const detalhes = obter(c.campos.detalhes);
  if (detalhes !== null && !objeto(detalhes)) return pendente("detalhes_invalidos");
  try { if (new TextEncoder().encode(JSON.stringify(detalhes)).length > 180_000) return pendente("limite_excedido"); }
  catch { return pendente("detalhes_invalidos"); }
  return { estado: "preparado", contratoId: c.id, projecao: { titulo: titulo.trim(), descricao: typeof descricao === "string" ? descricao.trim() || null : null,
    statusCampo, osExternaId: osExternaId ?? null, chamadoId: chamadoId ?? null, referenciaInvalida, ordemExterna, tecnicoAuvoId, dataAgendada, checkIn, checkOut, detalhes: detalhes as Record<string, unknown> | null } };
}
