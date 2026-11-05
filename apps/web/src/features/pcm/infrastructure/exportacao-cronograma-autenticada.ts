import type { IdentidadeSnapshotExportacao } from "../application/snapshot-exportacao";
import type { FiltroFotografiaExportacao } from "../application/exportacao-fotografia";
import { prepararExportacaoCronograma } from "../application/preparar-exportacao-cronograma";
import { supabase } from "../../../lib/supabase-client";
import { obterPaginaSnapshotExportacao } from "./supabase-snapshot-exportacao";
import { obterPaginaCronograma } from "./supabase-fonte-cronograma";
import { gerarPdfCronogramaFotografia, gerarXlsxCronogramaFotografia } from "./exportar-cronograma-fotografia";
import type { CronogramaFotografia, JanelaCronograma } from "../application/cronograma-fotografia";
import { consultarCapacidadeCronograma } from "./capacidade-cronograma";

/** A checagem de sessão reduz troca de ator observável; autorização permanece no servidor. */
export async function prepararCronogramaAutenticado(userId: string, ids: IdentidadeSnapshotExportacao, janela: JanelaCronograma, filtro: FiltroFotografiaExportacao, formato: "pdf" | "xlsx", signal?: AbortSignal, incluirCapacidade = false): Promise<Blob> {
  const identidade = { ...ids };
  const periodo = { inicio: janela.inicio, fim: janela.fim, feriadosInformados: [...janela.feriadosInformados], ...(janela.declaracoes ? { declaracoes: { contratoId: janela.declaracoes.contratoId, datas: [...janela.declaracoes.datas] } } : {}) };
  const filtroFixo = { ...filtro };
  if (formato !== "pdf" && formato !== "xlsx") throw new Error("Formato inválido.");
  async function conferirUsuario(): Promise<void> {
    signal?.throwIfAborted();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.id.toLowerCase() !== userId.toLowerCase()) throw new Error("Sessão alterada ou indisponível.");
    signal?.throwIfAborted();
  }
  const foto = async (posicao: number, abort?: AbortSignal) => { await conferirUsuario(); const data = await obterPaginaSnapshotExportacao(identidade, posicao, abort); await conferirUsuario(); return data; };
  const fonte: import("../application/fonte-cronograma-fotografia").ObterPaginaCronograma = async (cursor, abort) => { await conferirUsuario(); const data = await obterPaginaCronograma({ ...identidade, inicio: periodo.inicio, fim: periodo.fim }, cursor, abort); await conferirUsuario(); return data; };
  const capacidade = incluirCapacidade ? await consultarCapacidadeCronograma(userId, identidade.clienteId, periodo.inicio, periodo.fim, signal) : undefined;
  const gerar = formato === "pdf" ? gerarPdfCronogramaFotografia : gerarXlsxCronogramaFotografia;
  const compor = (cronograma: CronogramaFotografia) => gerar(capacidade ? { ...cronograma, capacidadeDeclarada: capacidade } : cronograma);
  const arquivo = await prepararExportacaoCronograma(foto, fonte, identidade, periodo, compor, filtroFixo, signal);
  if (capacidade && JSON.stringify(await consultarCapacidadeCronograma(userId, identidade.clienteId, periodo.inicio, periodo.fim, signal)) !== JSON.stringify(capacidade))
    throw new Error("Capacidade alterada durante exportação.");
  await conferirUsuario();
  return arquivo;
}
