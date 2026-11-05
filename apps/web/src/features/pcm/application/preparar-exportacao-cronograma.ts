import { chaveIdentidade } from "../domain/capacidade-por-tecnico";
import {
  type CronogramaFotografia,
  type JanelaCronograma,
  comporCronogramaFotografia,
} from "./cronograma-fotografia";
import {
  type FiltroFotografiaExportacao,
  projetarFotografiaExportacao,
} from "./exportacao-fotografia";
import {
  type ObterPaginaCronograma,
  lerFonteCronogramaFotografia,
} from "./fonte-cronograma-fotografia";
import {
  type IdentidadeSnapshotExportacao,
  type ObterPaginaSnapshotExportacao,
  confirmarSnapshotExportacao,
  lerSnapshotExportacao,
} from "./snapshot-exportacao";

/** Dupla leitura detecta mudanças observáveis; não garante atomicidade nem cobertura. */
export async function prepararExportacaoCronograma(
  foto: ObterPaginaSnapshotExportacao,
  fonte: ObterPaginaCronograma,
  ids: IdentidadeSnapshotExportacao,
  janela: JanelaCronograma,
  gerar: (cronograma: CronogramaFotografia) => Promise<Blob>,
  filtro: FiltroFotografiaExportacao = {},
  signal?: AbortSignal,
): Promise<Blob> {
  const janelaFixa = {
    inicio: janela.inicio,
    fim: janela.fim,
    feriadosInformados: [...janela.feriadosInformados],
    ...(janela.declaracoes
      ? {
          declaracoes: {
            contratoId: janela.declaracoes.contratoId,
            datas: [...janela.declaracoes.datas],
          },
        }
      : {}),
  };
  const filtroFixo = { ...filtro };
  const identidadeFixa = { ...ids };
  const snapshot = await lerSnapshotExportacao(foto, identidadeFixa, signal);
  const ocorrencias = await lerFonteCronogramaFotografia(fonte, snapshot, signal);
  const selecao = projetarFotografiaExportacao(snapshot, filtroFixo);
  const idsSelecionados = new Set(
    selecao.rotinas.map((r) => {
      if (!r.id) throw new Error("Rotina sem identificador.");
      return chaveIdentidade(r.id);
    }),
  );
  const rotinas = snapshot.rotinas.filter((r) => idsSelecionados.has(chaveIdentidade(r.id)));
  const selecionado = { ...snapshot, rotinas, total: rotinas.length };
  const arquivo = await gerar(
    comporCronogramaFotografia(
      selecionado,
      janelaFixa,
      ocorrencias.filter((o) => idsSelecionados.has(chaveIdentidade(o.rotinaId))),
      selecao.filtro,
    ),
  );
  signal?.throwIfAborted();
  await confirmarSnapshotExportacao(foto, identidadeFixa, snapshot, signal);
  const atual = await lerFonteCronogramaFotografia(fonte, snapshot, signal);
  if (JSON.stringify(atual) !== JSON.stringify(ocorrencias))
    throw new Error("Fonte alterada durante exportação.");
  signal?.throwIfAborted();
  return arquivo;
}
