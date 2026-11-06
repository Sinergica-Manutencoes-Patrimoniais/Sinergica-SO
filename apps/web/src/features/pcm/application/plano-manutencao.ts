import { z } from "zod";
import type {
  AdicionarRotinaCompletaGateway,
  AdicionarRotinaGateway,
  AprovarPlanoCommand,
  EditarRotinaCommand,
  EditarRotinaGateway,
  IniciarRevisaoPlanoCommand,
  RetirarRotinaCommand,
  RetirarRotinaGateway,
  RevisarPlanoGateway,
  RotinaCommand,
  SalvarPlanoCommand,
  SalvarPlanoGateway,
  TransicionarRevisaoCommand,
} from "./plano-manutencao-gateway";

const inteiro = z.number().int().nonnegative().max(2147483647);
const dataBase = z
  .string()
  .refine((valor) => {
    const data = new Date(`${valor}T00:00:00.000Z`);
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
      !Number.isNaN(data.getTime()) &&
      data.toISOString().slice(0, 10) === valor
    );
  }, "Data-base inválida.")
  .nullable();
const planoSchema = z
  .object({
    requestId: z.string().uuid(),
    expectedRevision: inteiro,
    planoId: z.string().uuid(),
    clienteId: z.string().uuid(),
    nome: z.string().trim().min(1).max(200),
  })
  .strict();
const rotinaCampos = {
  requestId: z.string().uuid(),
  expectedRevision: inteiro.min(1),
  planoId: z.string().uuid(),
  rotinaId: z.string().uuid(),
  nome: z.string().trim().min(1).max(200),
  alvoTipo: z.enum(["sistema", "componente", "grupo"]),
  alvoId: z.string().uuid(),
  modo: z.enum(["calendario", "visita"]),
  intervalo: inteiro.min(1).nullable(),
  unidade: z.enum(["dias", "semanas", "meses", "anos"]).nullable(),
  dataBase,
  tempoMinutos: inteiro.nullable(),
};
const validarParRecorrencia = (v: { intervalo: number | null; unidade: string | null }) =>
  (v.intervalo === null) === (v.unidade === null);
const rotinaSchema = z
  .object(rotinaCampos)
  .strict()
  .refine(validarParRecorrencia, "Informe intervalo e unidade juntos.");
const edicaoSchema = z
  .object({
    ...rotinaCampos,
    toleranciaAntes: inteiro,
    toleranciaDepois: inteiro,
    instrucao: z.string().trim().max(10000).nullable(),
    questionarioId: z.string().uuid().nullable(),
    tipoTempo: z.enum(["total", "por_unidade"]).nullable(),
  })
  .strict()
  .refine(validarParRecorrencia, "Informe intervalo e unidade juntos.");
const revisaoCampos = {
  requestId: z.string().uuid(),
  expectedRevision: inteiro.min(1),
  planoId: z.string().uuid(),
};
const retiradaSchema = z
  .object({
    ...revisaoCampos,
    rotinaId: z.string().uuid(),
    motivo: z.string().trim().min(1).max(2000),
  })
  .strict();
export function validarRetiradaRotina(comando: RetirarRotinaCommand): RetirarRotinaCommand {
  return retiradaSchema.parse(comando);
}
export async function retirarRotinaRascunho(
  gateway: RetirarRotinaGateway,
  comando: RetirarRotinaCommand,
) {
  return gateway.retirarRotina(validarRetiradaRotina(comando));
}
const transicaoSchema = z
  .object({ ...revisaoCampos, acao: z.enum(["submeter", "devolver"]) })
  .strict();
const aprovacaoSchema = z
  .object({
    ...revisaoCampos,
    vigencia: dataBase
      .refine((v) => v !== null, "Informe a vigência.")
      .transform((v) => v as string),
  })
  .strict();
const iniciarRevisaoSchema = z
  .object({ ...revisaoCampos, novaVersaoId: z.string().uuid() })
  .strict();

export function validarInicioRevisao(
  comando: IniciarRevisaoPlanoCommand,
): IniciarRevisaoPlanoCommand {
  return iniciarRevisaoSchema.parse(comando);
}
export async function iniciarRevisao(
  gateway: Pick<RevisarPlanoGateway, "iniciarRevisao">,
  comando: IniciarRevisaoPlanoCommand,
) {
  return gateway.iniciarRevisao(validarInicioRevisao(comando));
}

export function validarTransicaoRevisao(
  comando: TransicionarRevisaoCommand,
): TransicionarRevisaoCommand {
  return transicaoSchema.parse(comando);
}
export function validarAprovacaoPlano(comando: AprovarPlanoCommand): AprovarPlanoCommand {
  return aprovacaoSchema.parse(comando);
}
export async function transicionarRevisao(
  gateway: Pick<RevisarPlanoGateway, "transicionarRevisao">,
  comando: TransicionarRevisaoCommand,
) {
  return gateway.transicionarRevisao(validarTransicaoRevisao(comando));
}
export async function aprovarPlano(
  gateway: Pick<RevisarPlanoGateway, "aprovarPlano">,
  comando: AprovarPlanoCommand,
) {
  return gateway.aprovarPlano(validarAprovacaoPlano(comando));
}

export async function salvarPlanoRascunho(
  gateway: SalvarPlanoGateway,
  comando: SalvarPlanoCommand,
) {
  return gateway.salvarPlano(validarPlanoRascunho(comando));
}
export function validarPlanoRascunho(comando: SalvarPlanoCommand): SalvarPlanoCommand {
  return planoSchema.parse(comando);
}
export async function adicionarRotina(gateway: AdicionarRotinaGateway, comando: RotinaCommand) {
  return gateway.adicionarRotina(rotinaSchema.parse(comando));
}
export async function adicionarRotinaCompleta(
  gateway: AdicionarRotinaCompletaGateway,
  comando: EditarRotinaCommand,
) {
  return gateway.adicionarRotinaCompleta(validarRotinaCompleta(comando));
}
export function validarRotinaCompleta(comando: EditarRotinaCommand): EditarRotinaCommand {
  return edicaoSchema.parse(comando);
}
export async function editarRotina(gateway: EditarRotinaGateway, comando: EditarRotinaCommand) {
  return gateway.editarRotina(edicaoSchema.parse(comando));
}
