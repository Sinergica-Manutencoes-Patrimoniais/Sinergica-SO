import { z } from "zod";
import { ACOES_SSO } from "../domain/capacidades-sso";
import type {
  CapacidadesSsoGateway,
  DefinirConcessaoCommand,
  DefinirPerfilCommand,
  DefinirVinculoPerfilCommand,
} from "./capacidades-sso-gateway";

const envelope = {
  requestId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  motivo: z.string().trim().min(1).max(1000),
};
export const concessaoSchema = z
  .object({
    ...envelope,
    usuarioId: z.string().uuid().nullable(),
    perfilId: z.string().uuid().nullable(),
    acao: z.enum(ACOES_SSO),
    clienteId: z.string().uuid().nullable(),
    ativa: z.boolean(),
  })
  .strict()
  .superRefine((valor, ctx) => {
    if ((valor.usuarioId === null) === (valor.perfilId === null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe usuário ou perfil." });
    }
    if (valor.acao === "plano.gerir" && valor.perfilId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Gestão de Plano exige concessão individual.",
      });
    }
  });
export const perfilSchema = z
  .object({
    ...envelope,
    perfilId: z.string().uuid(),
    nome: z.string().trim().min(1).max(120),
    ativo: z.boolean(),
  })
  .strict();
export const vinculoSchema = z
  .object({
    ...envelope,
    usuarioId: z.string().uuid(),
    perfilId: z.string().uuid(),
    ativo: z.boolean(),
  })
  .strict();

export async function definirConcessao(
  gateway: CapacidadesSsoGateway,
  input: DefinirConcessaoCommand,
) {
  return gateway.definirConcessao(concessaoSchema.parse(input));
}
export async function definirPerfil(gateway: CapacidadesSsoGateway, input: DefinirPerfilCommand) {
  return gateway.definirPerfil(perfilSchema.parse(input));
}
export async function definirVinculoPerfil(
  gateway: CapacidadesSsoGateway,
  input: DefinirVinculoPerfilCommand,
) {
  return gateway.definirVinculoPerfil(vinculoSchema.parse(input));
}
