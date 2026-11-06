import type { CamposCriticosOperacionais } from "./contrato-operacional.ts";

type Alvo = { tipo: "sistema" | "equipamento" | "componente" | "grupo_quantitativo"; idSso: string; equipamentoAuvoId: number | null; mapeamentoConferido: boolean };
export type FonteCamposT24 = {
  contratoComprovado: boolean; operacao: "criar" | "atualizar"; tarefaAuvoId: number | null;
  inicio: string; tecnico: { idSso: string; auvoId: number | null; mapeamentoConferido: boolean };
  alvo: Alvo; questionario: { obrigatorio: boolean; auvoId: number | null; mapeamentoConferido: boolean };
};
/** Linhas oficiais lidas pelo chamador; a origem e as travas devem ser comprovadas no banco. */
export type FontesOficiaisT24 = {
  contratoComprovado: boolean;
  clienteId: string;
  visita: { clienteId: string; inicio: string; responsavelId: string | null };
  os: { clienteId: string; tarefaAuvoId: number | null };
  tecnico: { id: string; auvoId: number | null; ativo: boolean } | null;
  alvoEsperado: { id: string; tipo: Alvo["tipo"] } | null;
  alvo: { id: string; clienteId: string; tipo: Alvo["tipo"]; equipamentoAuvoId: number | null; ativo: boolean } | null;
  questionario: { obrigatorio: boolean; idEsperado: string | null; idLido: string | null; auvoId: number | null; ativo: boolean };
};
type Campos = Omit<CamposCriticosOperacionais, "tarefaId">;
type Resultado =
  | { situacao: "bloqueada"; motivos: string[] }
  | { situacao: "preparada"; operacao: "criar" | "atualizar"; tarefaId: string | null; esperado: Campos; questionarioObrigatorio: boolean };

const identificadorSso = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const identificadorAuvo = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x > 0;
function inicioValido(valor: unknown): valor is string {
  if (typeof valor !== "string") return false;
  const p = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(valor);
  if (!p || p[1] === "0000" || Number(p[4]) > 23 || Number(p[5]) > 59 || Number(p[6]) > 59 || !Number.isFinite(Date.parse(valor))) return false;
  const civil = new Date(0); civil.setUTCFullYear(Number(p[1]), Number(p[2]) - 1, Number(p[3]));
  return civil.getUTCFullYear() === Number(p[1]) && civil.getUTCMonth() === Number(p[2]) - 1 && civil.getUTCDate() === Number(p[3]);
}

/** Não faz I/O, não verifica procedência nem confirma que o fornecedor aceitará o payload. */
export function projetarCamposT24(fonte: FonteCamposT24): Resultado {
  const motivos: string[] = [];
  if (!fonte || fonte.contratoComprovado !== true) motivos.push("contrato_nao_comprovado");
  if (!fonte || !["criar", "atualizar"].includes(fonte.operacao) ||
    (fonte.operacao === "criar" && fonte.tarefaAuvoId !== null) ||
    (fonte.operacao === "atualizar" && !identificadorAuvo(fonte.tarefaAuvoId))) motivos.push("identidade_tarefa_incompativel");
  if (!inicioValido(fonte?.inicio)) motivos.push("inicio_invalido");
  if (!fonte?.tecnico || !identificadorSso(fonte.tecnico.idSso) || !identificadorAuvo(fonte.tecnico.auvoId) || fonte.tecnico.mapeamentoConferido !== true)
    motivos.push("tecnico_nao_mapeado");
  if (!fonte?.alvo || !["sistema", "equipamento", "componente", "grupo_quantitativo"].includes(fonte.alvo.tipo) ||
    !identificadorSso(fonte.alvo.idSso) || !identificadorAuvo(fonte.alvo.equipamentoAuvoId) || fonte.alvo.mapeamentoConferido !== true)
    motivos.push("alvo_nao_mapeado");
  if (!fonte?.questionario || typeof fonte.questionario.obrigatorio !== "boolean" ||
    (fonte.questionario.obrigatorio && (!identificadorAuvo(fonte.questionario.auvoId) || fonte.questionario.mapeamentoConferido !== true)) ||
    (fonte.questionario.auvoId !== null && (!identificadorAuvo(fonte.questionario.auvoId) || fonte.questionario.mapeamentoConferido !== true)))
    motivos.push("questionario_nao_mapeado");
  if (motivos.length) return { situacao: "bloqueada", motivos };
  return { situacao: "preparada", operacao: fonte.operacao, tarefaId: fonte.tarefaAuvoId === null ? null : String(fonte.tarefaAuvoId),
    esperado: { tecnicoId: String(fonte.tecnico.auvoId), inicio: fonte.inicio, alvoId: String(fonte.alvo.equipamentoAuvoId),
      questionarioId: fonte.questionario.auvoId === null ? null : String(fonte.questionario.auvoId) },
    questionarioObrigatorio: fonte.questionario.obrigatorio };
}

/**
 * Resolve identidades por chaves explícitas e isola Clientes. Não consulta nem
 * trava registros, não verifica ciência/confirmacão e não autoriza rede.
 */
export function projetarFontesOficiaisT24(fonte: FontesOficiaisT24): Resultado {
  if (!fonte || !identificadorSso(fonte.clienteId) || fonte.visita?.clienteId !== fonte.clienteId ||
    fonte.os?.clienteId !== fonte.clienteId || fonte.alvo?.clienteId !== fonte.clienteId)
    return { situacao: "bloqueada", motivos: ["cliente_ou_fonte_incompativel"] };
  const tecnico = fonte.tecnico;
  const alvo = fonte.alvo;
  const questionario = fonte.questionario;
  if (!tecnico || !alvo || !questionario) return { situacao: "bloqueada", motivos: ["fonte_incompleta"] };
  if (!fonte.alvoEsperado || !identificadorSso(fonte.alvoEsperado.id) || !identificadorSso(alvo.id) ||
    fonte.alvoEsperado.id.toLowerCase() !== alvo.id.toLowerCase() || fonte.alvoEsperado.tipo !== alvo.tipo)
    return { situacao: "bloqueada", motivos: ["alvo_divergente"] };
  if ((questionario.idEsperado !== null && !identificadorSso(questionario.idEsperado)) ||
    questionario.idEsperado !== questionario.idLido ||
    (questionario.idEsperado === null && questionario.auvoId !== null) ||
    (questionario.idEsperado !== null && (!identificadorAuvo(questionario.auvoId) || questionario.ativo !== true)))
    return { situacao: "bloqueada", motivos: ["questionario_divergente"] };
  return projetarCamposT24({
    contratoComprovado: fonte.contratoComprovado,
    operacao: fonte.os.tarefaAuvoId === null ? "criar" : "atualizar",
    tarefaAuvoId: fonte.os.tarefaAuvoId,
    inicio: fonte.visita.inicio,
    tecnico: { idSso: tecnico.id, auvoId: tecnico.auvoId, mapeamentoConferido: tecnico.ativo === true && fonte.visita.responsavelId === tecnico.id },
    alvo: { tipo: alvo.tipo, idSso: alvo.id, equipamentoAuvoId: alvo.equipamentoAuvoId,
      mapeamentoConferido: alvo.ativo === true && alvo.tipo !== "grupo_quantitativo" },
    questionario: { obrigatorio: questionario.obrigatorio, auvoId: questionario.auvoId,
      mapeamentoConferido: questionario.ativo === true && questionario.idEsperado !== null },
  });
}
