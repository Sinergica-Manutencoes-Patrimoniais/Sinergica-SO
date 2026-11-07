import { z } from "zod";
import { chaveIdentidade } from "../domain/capacidade-por-tecnico";
import type { SnapshotExportacao } from "./snapshot-exportacao";

const uuid = z.string().guid();
const linhaSchema = z.object({
  tipo: z.enum(["calendario", "visita"]), id: uuid, clienteId: uuid, planoId: uuid, versaoId: uuid, rotinaId: uuid, alvoId: uuid,
  vencimentoOriginal: z.string().date(), dataProgramada: z.string().date().nullable(),
  visitaEstado: z.enum(["rascunho", "planejada", "confirmada", "enviada", "em_execucao", "parcial", "concluida", "reprogramada", "cancelada"]).nullable(),
  visitaRevisao: z.number().int().positive().nullable(), snapshotHash: z.string().regex(/^[a-f0-9]{32}$/), completude: z.literal("desconhecida"),
}).superRefine((item, ctx) => {
  const invalido = item.tipo === "calendario"
    ? item.dataProgramada !== null || item.visitaEstado !== null || item.visitaRevisao !== null
    : item.visitaEstado === null || item.visitaRevisao === null || (item.visitaEstado === "cancelada") !== (item.dataProgramada === null);
  if (invalido) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Estado de Visita inconsistente." });
});
export type OcorrenciaCronogramaFonte = z.infer<typeof linhaSchema>;
export type CursorCronograma = { tipo: "calendario" | "visita"; id: string };
export type ObterPaginaCronograma = (apos: CursorCronograma | null, signal?: AbortSignal) => Promise<unknown>;

/** Fonte parcial: paginação consistente não comprova completude nem isolamento entre requisições. */
export async function lerFonteCronogramaFotografia(obter: ObterPaginaCronograma, snapshot: SnapshotExportacao, signal?: AbortSignal): Promise<OcorrenciaCronogramaFonte[]> {
  const rotinas = new Map(snapshot.rotinas.map((r) => [chaveIdentidade(r.id), r]));
  if (rotinas.size !== snapshot.rotinas.length || snapshot.rotinas.length !== snapshot.total) throw new Error("Fotografia incompleta.");
  const resultado: OcorrenciaCronogramaFonte[] = [];
  let cursor: CursorCronograma | null = null;
  for (;;) {
    signal?.throwIfAborted();
    const pagina = z.array(linhaSchema).max(100).parse(await obter(cursor, signal));
    signal?.throwIfAborted();
    for (const item of pagina) {
      const rotina = rotinas.get(chaveIdentidade(item.rotinaId));
      if (!rotina || rotina.modo !== item.tipo || chaveIdentidade(item.alvoId) !== chaveIdentidade(rotina.alvoId) || chaveIdentidade(item.clienteId) !== chaveIdentidade(snapshot.clienteId) || chaveIdentidade(item.planoId) !== chaveIdentidade(snapshot.planoId) || chaveIdentidade(item.versaoId) !== chaveIdentidade(snapshot.versaoId) || item.snapshotHash !== snapshot.snapshotHash) throw new Error("Ocorrência ou fotografia divergente.");
      if (cursor && (item.tipo < cursor.tipo || (item.tipo === cursor.tipo && chaveIdentidade(item.id) <= chaveIdentidade(cursor.id)))) throw new Error("Paginação de ocorrências inconsistente.");
      cursor = { tipo: item.tipo, id: item.id };
      resultado.push(item);
      if (resultado.length > 1_000_000) throw new Error("Fonte extensa demais para exportação.");
    }
    if (pagina.length < 100) return resultado;
  }
}
