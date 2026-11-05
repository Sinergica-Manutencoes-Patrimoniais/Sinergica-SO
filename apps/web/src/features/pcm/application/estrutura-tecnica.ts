import { z } from "zod";
import type {
  EstruturaTecnicaGateway,
  MoverComponenteCommand,
  MovimentarComponenteGateway,
  SalvarGrupoCommand,
} from "./estrutura-tecnica-gateway";

const grupoSchema = z
  .object({
    requestId: z.string().uuid(),
    expectedRevision: z.number().int().nonnegative(),
    grupoId: z.string().uuid(),
    localId: z.string().uuid(),
    categoriaId: z.string().uuid(),
    sistemaId: z.string().uuid().nullable(),
    nome: z.string().trim().min(1).max(200),
    quantidade: z.number().int().positive().safe(),
    caracteristicas: z.record(z.string()),
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
    requestId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
    componenteId: z.string().uuid(),
    areaId: z.string().uuid().nullable(),
    localId: z.string().uuid().nullable(),
    parentId: z.string().uuid().nullable(),
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
