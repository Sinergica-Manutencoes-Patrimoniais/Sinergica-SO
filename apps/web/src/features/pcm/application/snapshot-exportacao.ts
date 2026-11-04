import { z } from "zod";
import { chaveIdentidade } from "../domain/capacidade-por-tecnico";

const id = z.string().uuid();
const data = z.string().date().nullable();
const rotina = z.object({
  id, planoId: id, versaoId: id, nome: z.string().min(1),
  alvoTipo: z.enum(["sistema", "componente", "grupo"]), alvoId: id, alvoNome: z.string().min(1),
  alvoNatureza: z.enum(["equipamento", "componente"]).nullable().optional(),
  modo: z.enum(["calendario", "visita"]), intervalo: z.number().int().positive().nullable(),
  unidade: z.enum(["dias", "semanas", "meses", "anos"]).nullable(), dataBase: data,
  tempoMinutos: z.number().int().nonnegative().nullable(), tipoTempo: z.enum(["total", "por_unidade"]).nullable(),
  toleranciaAntes: z.number().int().nonnegative(), toleranciaDepois: z.number().int().nonnegative(),
}).refine((r) => r.intervalo !== null && r.unidade !== null && (r.modo !== "calendario" || r.dataBase !== null), "Recorrência ou data-base incompleta.")
  .refine((r) => r.alvoTipo === "componente" || r.alvoNatureza == null, "Natureza incompatível.");

const pagina = z.object({
  clienteId: id, planoId: id, versaoId: id, planoNome: z.string().min(1), versaoNumero: z.number().int().positive(),
  vigenciaInicio: data, vigenciaFim: data, snapshotHash: z.string().regex(/^[a-f0-9]{32}$/),
  total: z.number().int().nonnegative().max(1_048_575), posicao: z.number().int().nonnegative(),
  proximaPosicao: z.number().int().nonnegative().nullable(), rotinas: z.array(rotina).max(100),
  capacidadeIncluida: z.literal(false), cronogramaOperacionalIncluido: z.literal(false),
});

export type IdentidadeSnapshotExportacao = { clienteId: string; planoId: string; versaoId: string };
export type ObterPaginaSnapshotExportacao = (posicao: number, signal?: AbortSignal) => Promise<unknown>;
export type SnapshotExportacao = Omit<z.infer<typeof pagina>, "posicao" | "proximaPosicao">;

/** Reúne apenas páginas completas e consistentes; não comprova autorização ou estabilidade futura. */
export async function lerSnapshotExportacao(obterPagina: ObterPaginaSnapshotExportacao, identidade: IdentidadeSnapshotExportacao, signal?: AbortSignal): Promise<SnapshotExportacao> {
  let posicao = 0;
  let base: Omit<SnapshotExportacao, "rotinas"> | undefined;
  const rotinas: SnapshotExportacao["rotinas"] = [];
  const vistos = new Set<string>();
  do {
    signal?.throwIfAborted();
    const atual = pagina.parse(await obterPagina(posicao, signal));
    signal?.throwIfAborted();
    const { posicao: recebida, proximaPosicao, rotinas: itens, ...metadados } = atual;
    if (chaveIdentidade(metadados.clienteId) !== chaveIdentidade(identidade.clienteId) || chaveIdentidade(metadados.planoId) !== chaveIdentidade(identidade.planoId) || chaveIdentidade(metadados.versaoId) !== chaveIdentidade(identidade.versaoId)) throw new Error("Identidade de fotografia divergente.");
    if (base && JSON.stringify(base) !== JSON.stringify(metadados)) throw new Error("Fotografia alterada entre páginas.");
    base ??= metadados;
    const quantidade = Math.min(100, metadados.total - posicao);
    if (recebida !== posicao || quantidade < 0 || itens.length !== quantidade || proximaPosicao !== (posicao + quantidade < metadados.total ? posicao + quantidade : null)) throw new Error("Paginação de fotografia incompleta.");
    for (const r of itens) {
      const chave = chaveIdentidade(r.id);
      if (chaveIdentidade(r.planoId) !== chaveIdentidade(identidade.planoId) || chaveIdentidade(r.versaoId) !== chaveIdentidade(identidade.versaoId) || vistos.has(chave)) throw new Error("Rotina duplicada ou de outra versão.");
      vistos.add(chave);
      rotinas.push(r);
    }
    if (proximaPosicao === null) break;
    posicao = proximaPosicao;
  } while (true);
  return { ...base!, rotinas };
}

/** A comparação de conteúdo complementa o fingerprint, que não é prova de autenticidade. */
export async function confirmarSnapshotExportacao(obterPagina: ObterPaginaSnapshotExportacao, identidade: IdentidadeSnapshotExportacao, anterior: SnapshotExportacao, signal?: AbortSignal): Promise<void> {
  const atual = await lerSnapshotExportacao(obterPagina, identidade, signal);
  if (JSON.stringify(atual) !== JSON.stringify(anterior)) throw new Error("Fotografia alterada antes do download.");
}
