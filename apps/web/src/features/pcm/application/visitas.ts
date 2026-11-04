import { z } from "zod";
import type { VisitasGateway } from "./visitas-gateway";

const identificador = z.string().uuid();
const contextoSchema = z.object({ usuarioId: identificador, clienteId: identificador, visitaId: identificador }).strict();
const inteiro = z.number().int().nonnegative().max(2147483647);
const base = { requestId: identificador, expectedRevision: inteiro.min(1), visitaId: identificador };
const dados = { areaId: identificador.nullable(), localId: identificador.nullable(),
  inicioEm: z.string().datetime({ offset: true }), fimEm: z.string().datetime({ offset: true }),
  fuso: z.string().trim().min(1), responsavelId: identificador.nullable(), deslocamentoMinutos: inteiro };
const operacaoSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("confirmar"),
    comando: z.object(base).strict(),
  }).strict(),
  z.object({ tipo: z.literal("planejar"), comando: z.object(base).strict() }).strict(),
  z.object({ tipo: z.literal("registrarCiencia"), comando: z.object({ ...base,
    cienciaEm: z.string().datetime({ offset: true }), responsavel: z.string().trim().min(1).max(200),
    canal: z.string().trim().min(1).max(120), observacao: z.string().trim().min(1).max(2000),
  }).strict() }).strict(),
  z.object({ tipo: z.literal("criar"), comando: z.object({ ...base, ...dados, expectedRevision: z.literal(0),
    clienteId: identificador, contratoId: identificador.nullable(), natureza: z.enum(["regular", "extra", "reposicao_manual"]) }).strict() }).strict(),
  z.object({ tipo: z.literal("editar"), comando: z.object({ ...base, ...dados }).strict() }).strict(),
  z.object({ tipo: z.literal("associarOs"), comando: z.object({ ...base, osId: identificador, vinculoId: identificador,
    sequencia: inteiro.min(1), estimativaMinutos: inteiro.nullable() }).strict() }).strict(),
  z.object({ tipo: z.literal("adicionarMembro"), comando: z.object({ ...base, funcionarioId: identificador,
    participacaoId: identificador, papel: z.string().trim().min(1).max(120), estimativaMinutos: inteiro.min(1).nullable() }).strict() }).strict(),
  z.object({ tipo: z.literal("encerrarMembro"), comando: z.object({ ...base, participacaoId: identificador,
    motivo: z.string().trim().min(1).max(2000) }).strict() }).strict(),
  z.object({ tipo: z.literal("desvincularOs"), comando: z.object({ ...base, vinculoId: identificador,
    motivo: z.string().trim().min(1).max(2000) }).strict() }).strict(),
]).superRefine((operacao, ctx) => {
  if (operacao.tipo === "criar" || operacao.tipo === "editar") {
    const comando = operacao.comando;
    if (Date.parse(comando.fimEm) <= Date.parse(comando.inicioEm))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Janela inválida." });
    if (comando.localId !== null && comando.areaId === null)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Local exige Área." });
  }
});
export type OperacaoVisita = z.infer<typeof operacaoSchema>;
export function validarCriacaoVisita(valor: unknown, clienteId: string) {
  const operacao = operacaoSchema.parse({ tipo: "criar", comando: valor });
  if (operacao.tipo !== "criar" || operacao.comando.clienteId !== clienteId) throw new Error("Cliente divergente.");
  return operacao.comando;
}

interface ArmazenamentoSessao {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

/** Um pedido incerto permanece imutável até uma repetição ser confirmada. */
export function criarOperacoesVisita(
  gateway: Partial<Pick<VisitasGateway, "confirmar" | "planejar" | "registrarCiencia" | "criar" | "editar" | "associarOs" | "adicionarMembro" | "encerrarMembro" | "desvincularOs">>,
  armazenamento: ArmazenamentoSessao,
  contexto: { usuarioId: string; clienteId: string; visitaId: string },
) {
  const escopo = contextoSchema.parse(contexto);
  const chave = `sso-visita-operacao:${escopo.usuarioId}:${escopo.clienteId}:${escopo.visitaId}`;
  function validar(valor: unknown): OperacaoVisita {
    const operacao = operacaoSchema.parse(valor);
    if (operacao.comando.visitaId !== escopo.visitaId) throw new Error("Visita divergente.");
    if (operacao.tipo === "criar" && operacao.comando.clienteId !== escopo.clienteId) throw new Error("Cliente divergente.");
    return operacao;
  }
  function pendente(): OperacaoVisita | null {
    const salvo = armazenamento.getItem(chave);
    return salvo === null ? null : validar(JSON.parse(salvo));
  }
  async function executar(operacao: OperacaoVisita) {
    function limparSeAtual() {
      if (armazenamento.getItem(chave) === JSON.stringify(operacao)) armazenamento.removeItem(chave);
    }
    let resultado;
    try {
      if (operacao.tipo === "confirmar") {
        if (!gateway.confirmar) throw new Error("Operação indisponível.");
        resultado = await gateway.confirmar(operacao.comando);
      } else if (operacao.tipo === "planejar") {
        if (!gateway.planejar) throw new Error("Operação indisponível.");
        resultado = await gateway.planejar(operacao.comando);
      } else if (operacao.tipo === "registrarCiencia") {
        if (!gateway.registrarCiencia) throw new Error("Operação indisponível.");
        resultado = await gateway.registrarCiencia(operacao.comando);
      } else if (operacao.tipo === "criar") {
        if (!gateway.criar) throw new Error("Operação indisponível.");
        resultado = await gateway.criar(operacao.comando);
      } else if (operacao.tipo === "editar") {
        if (!gateway.editar) throw new Error("Operação indisponível.");
        resultado = await gateway.editar(operacao.comando);
      } else if (operacao.tipo === "associarOs") {
        if (!gateway.associarOs) throw new Error("Operação indisponível.");
        resultado = await gateway.associarOs(operacao.comando);
      } else if (operacao.tipo === "adicionarMembro") {
        if (!gateway.adicionarMembro) throw new Error("Operação indisponível.");
        resultado = await gateway.adicionarMembro(operacao.comando);
      } else if (operacao.tipo === "encerrarMembro") {
        if (!gateway.encerrarMembro) throw new Error("Operação indisponível.");
        resultado = await gateway.encerrarMembro(operacao.comando);
      } else {
        if (!gateway.desvincularOs) throw new Error("Operação indisponível.");
        resultado = await gateway.desvincularOs(operacao.comando);
      }
    } catch (erro) {
      const codigo = typeof erro === "object" && erro !== null && "code" in erro ? erro.code : null;
      const mensagem = typeof erro === "object" && erro !== null && "message" in erro && typeof erro.message === "string" ? erro.message : "";
      const conflitoComprovado = codigo === "23505" && (
        (operacao.tipo === "associarOs" && ["uq_visita_sequencia_vigente", "uq_visita_os_vigente"].some((nome) => mensagem.includes(`unique constraint "${nome}"`)))
        || (operacao.tipo === "adicionarMembro" && mensagem.includes('unique constraint "uq_visita_funcionario_vigente"'))
      );
      if ((typeof codigo === "string" && ["22023", "23514", "40001"].includes(codigo)) || conflitoComprovado) {
        limparSeAtual();
      }
      throw erro;
    }
    limparSeAtual();
    return resultado;
  }
  return {
    pendente,
    async iniciar(valor: OperacaoVisita) {
      const operacao = validar(valor);
      if (pendente()) throw new Error("Resolva a operação pendente antes de continuar.");
      armazenamento.setItem(chave, JSON.stringify(operacao));
      return executar(operacao);
    },
    async repetir() {
      const operacao = pendente();
      if (!operacao) throw new Error("Nenhuma operação pendente.");
      return executar(operacao);
    },
  };
}
