import { z } from "zod";

export const criarOsChamadoSchema = z.object({
  requestId: z.string().uuid(),
  expectedRevision: z.number().int().safe().positive(),
  chamadoId: z.string().uuid(),
  clienteId: z.string().uuid(),
  osId: z.string().uuid(),
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().nullable(),
  categoria: z.enum(["preventiva", "corretiva", "emergencial"]),
}).strict();

export type CriarOsChamado = z.infer<typeof criarOsChamadoSchema>;
export type ResultadoCriarOsChamado = {
  chamadoId: string; osId: string; numero: string; revision: number; requestId: string;
};
export type CriacaoOsChamadoGateway = {
  criar(comando: CriarOsChamado): Promise<ResultadoCriarOsChamado>;
  consultarRevisao(cliente: string, chamado: string, signal?: AbortSignal): Promise<number>;
  reconciliar?(comando: CriarOsChamado): Promise<{ estado: "indeterminado" } | { estado: "confirmado"; resultado: ResultadoCriarOsChamado }>;
};
