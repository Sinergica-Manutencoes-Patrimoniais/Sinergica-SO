import { z } from "zod";
import type {
  EstruturaTecnicaGateway,
  MoverComponenteCommand,
  MovimentarComponenteGateway,
  SalvarGrupoCommand,
} from "./estrutura-tecnica-gateway";

const grupoSchema = z
  .object({
    requestId: z.string().guid(),
    expectedRevision: z.number().int().nonnegative(),
    grupoId: z.string().guid(),
    localId: z.string().guid(),
    categoriaId: z.string().guid(),
    sistemaId: z.string().guid().nullable(),
    nome: z.string().trim().min(1).max(200),
    quantidade: z.number().int().positive().safe(),
    caracteristicas: z.record(z.string(), z.string()),
  })
  .strict();

export async function salvarGrupoQuantitativo(
  gateway: EstruturaTecnicaGateway,
  input: SalvarGrupoCommand,
) {
  return gateway.salvarGrupo(validarComandoGrupo(input));
}

export function validarComandoGrupo(input: SalvarGrupoCommand): SalvarGrupoCommand {
  return grupoSchema.parse(input);
}

const moverSchema = z
  .object({
    requestId: z.string().guid(),
    expectedRevision: z.number().int().positive(),
    componenteId: z.string().guid(),
    areaId: z.string().guid().nullable(),
    localId: z.string().guid().nullable(),
    parentId: z.string().guid().nullable(),
  })
  .strict()
  .refine((v) => !v.localId || Boolean(v.areaId), {
    message: "Informe a Área do Local.",
    path: ["areaId"],
  });
export async function moverComponente(
  gateway: MovimentarComponenteGateway,
  input: MoverComponenteCommand,
) {
  return gateway.moverComponente(validarMovimentoComponente(input));
}

export function validarMovimentoComponente(input: MoverComponenteCommand): MoverComponenteCommand {
  return moverSchema.parse(input);
}
