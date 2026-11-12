import { z } from "zod";
import {
  RESULTADOS_RESPOSTA,
  type ResultadoResposta,
  respostaValida,
} from "../domain/validacao-os";
import type { ValidacaoOsGateway } from "./validacao-os-gateway";

const identificador = z.string().guid();
const inteiro = z.number().int().nonnegative().max(2147483647);
const justificativa = z.string().trim().min(1).max(2000);

const respostaSchema = z
  .object({
    perguntaId: z.string().trim().min(1).max(200),
    resultado: z.enum(RESULTADOS_RESPOSTA as [ResultadoResposta, ...ResultadoResposta[]]),
    observacao: z.string().max(4000).nullable().default(null),
  })
  .strict()
  .superRefine((resposta, ctx) => {
    if (!respostaValida(resposta)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Observação obrigatória quando o resultado é não aplicável.",
      });
    }
  });

const base = { requestId: identificador, clienteId: identificador };
const operacaoSchema = z.discriminatedUnion("tipo", [
  z
    .object({
      tipo: z.literal("classificar"),
      comando: z
        .object({
          ...base,
          envelopeId: identificador,
          resolucaoId: identificador,
          retornoId: identificador,
          respostas: z.array(respostaSchema).min(1).max(1000),
        })
        .strict()
        .superRefine((comando, ctx) => {
          const ids = new Set<string>();
          for (const resposta of comando.respostas) {
            if (ids.has(resposta.perguntaId)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Pergunta respondida mais de uma vez.",
              });
            }
            ids.add(resposta.perguntaId);
          }
        }),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("conferirCobertura"),
      comando: z
        .object({
          ...base,
          retornoId: identificador,
          evidenciaId: identificador.nullable(),
          expectedEvidencias: inteiro,
          justificativa,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("aprovarFinalizar"),
      comando: z
        .object({
          ...base,
          retornoId: identificador,
          conferenciaId: identificador,
          expectedEvidencias: inteiro,
          expectedDecisao: inteiro,
          justificativa,
          expectedOsId: identificador,
          expectedStatus: z.string().trim().min(1).max(60),
          expectedUpdatedAt: z.string().datetime({ offset: true }),
        })
        .strict(),
    })
    .strict(),
]);
export type OperacaoValidacaoOs = z.infer<typeof operacaoSchema>;

interface ArmazenamentoSessao {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

/** Um pedido incerto permanece imutável até uma repetição ser confirmada — mesmo padrão de
 * `criarOperacoesVisita` (E01-S171): classificar/conferir/aprovar nunca duplicam efeito em retry. */
export function criarOperacoesValidacaoOs(
  gateway: Partial<
    Pick<
      ValidacaoOsGateway,
      "classificarRetorno" | "conferirCoberturaRetorno" | "aprovarFinalizarOs"
    >
  >,
  armazenamento: ArmazenamentoSessao,
  contexto: { usuarioId: string; clienteId: string; retornoId: string },
) {
  const chave = `sso-validacao-os-operacao:${JSON.stringify([
    contexto.usuarioId,
    contexto.clienteId,
    contexto.retornoId,
  ])}`;
  function validar(valor: unknown): OperacaoValidacaoOs {
    const operacao = operacaoSchema.parse(valor);
    if (operacao.comando.clienteId !== contexto.clienteId) throw new Error("Cliente divergente.");
    if (operacao.comando.retornoId !== contexto.retornoId) throw new Error("Retorno divergente.");
    return operacao;
  }
  function pendente(): OperacaoValidacaoOs | null {
    const salvo = armazenamento.getItem(chave);
    return salvo === null ? null : validar(JSON.parse(salvo));
  }
  async function executar(operacao: OperacaoValidacaoOs) {
    function limparSeAtual() {
      if (armazenamento.getItem(chave) === JSON.stringify(operacao))
        armazenamento.removeItem(chave);
    }
    let resultado: Awaited<
      ReturnType<
        ValidacaoOsGateway["classificarRetorno" | "conferirCoberturaRetorno" | "aprovarFinalizarOs"]
      >
    >;
    try {
      if (operacao.tipo === "classificar") {
        if (!gateway.classificarRetorno) throw new Error("Operação indisponível.");
        resultado = await gateway.classificarRetorno(operacao.comando);
      } else if (operacao.tipo === "conferirCobertura") {
        if (!gateway.conferirCoberturaRetorno) throw new Error("Operação indisponível.");
        resultado = await gateway.conferirCoberturaRetorno(operacao.comando);
      } else {
        if (!gateway.aprovarFinalizarOs) throw new Error("Operação indisponível.");
        resultado = await gateway.aprovarFinalizarOs(operacao.comando);
      }
    } catch (erro) {
      const codigo = typeof erro === "object" && erro !== null && "code" in erro ? erro.code : null;
      if (typeof codigo === "string" && ["22023", "23514", "40001"].includes(codigo)) {
        limparSeAtual();
      }
      throw erro;
    }
    limparSeAtual();
    return resultado;
  }
  return {
    pendente,
    async iniciar(valor: OperacaoValidacaoOs) {
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
