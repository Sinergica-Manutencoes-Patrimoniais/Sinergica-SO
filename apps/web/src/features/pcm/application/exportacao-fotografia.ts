import { z } from "zod";
import { chaveIdentidade } from "../domain/capacidade-por-tecnico";
import type { DadosExportacaoVersao } from "../domain/exportacao-plano";
import {
  type IdentidadeSnapshotExportacao,
  type ObterPaginaSnapshotExportacao,
  type SnapshotExportacao,
  confirmarSnapshotExportacao,
  lerSnapshotExportacao,
} from "./snapshot-exportacao";

export type FiltroFotografiaExportacao = {
  alvoTipo?: "sistema" | "componente" | "grupo";
  alvoId?: string;
  modo?: "calendario" | "visita";
  snapshotHashSelecionado?: string;
};

export function projetarFotografiaExportacao(
  snapshot: SnapshotExportacao,
  filtro: FiltroFotografiaExportacao,
): DadosExportacaoVersao {
  if (filtro.alvoId !== undefined) z.string().uuid().parse(filtro.alvoId);
  if (filtro.snapshotHashSelecionado !== undefined) {
    z.string()
      .regex(/^[a-f0-9]{32}$/)
      .parse(filtro.snapshotHashSelecionado);
    const alvoId = filtro.alvoId;
    if (
      !alvoId ||
      !filtro.alvoTipo ||
      snapshot.snapshotHash !== filtro.snapshotHashSelecionado ||
      !snapshot.rotinas.some(
        (r) =>
          r.alvoTipo === filtro.alvoTipo && chaveIdentidade(r.alvoId) === chaveIdentidade(alvoId),
      )
    )
      throw new Error("Alvo ou fotografia selecionada mudou.");
  }
  const partes = [
    filtro.alvoTipo && `tipo=${filtro.alvoTipo}`,
    filtro.alvoId && `alvo=${filtro.alvoId}`,
    filtro.modo && `modo=${filtro.modo}`,
  ].filter(Boolean);
  return {
    clienteId: snapshot.clienteId,
    planoNome: snapshot.planoNome,
    versaoId: snapshot.versaoId,
    versaoNumero: snapshot.versaoNumero,
    vigenciaInicio: snapshot.vigenciaInicio,
    vigenciaFim: snapshot.vigenciaFim,
    snapshotHash: snapshot.snapshotHash,
    filtro: partes.length ? partes.join("; ") : "todas as Rotinas da versão",
    rotinas: snapshot.rotinas.filter(
      (r) =>
        (!filtro.alvoTipo || filtro.alvoTipo === r.alvoTipo) &&
        (!filtro.alvoId || chaveIdentidade(filtro.alvoId) === chaveIdentidade(r.alvoId)) &&
        (!filtro.modo || filtro.modo === r.modo),
    ),
  };
}

/** Não entrega artefato caso a reconsulta autorizada diverja ou seja cancelada. */
export async function prepararExportacaoFotografia(
  obterPagina: ObterPaginaSnapshotExportacao,
  identidade: IdentidadeSnapshotExportacao,
  filtro: FiltroFotografiaExportacao,
  gerar: (dados: DadosExportacaoVersao) => Promise<Blob>,
  signal?: AbortSignal,
): Promise<Blob> {
  const identidadeFixa = { ...identidade };
  const filtroFixo = { ...filtro };
  const snapshot = await lerSnapshotExportacao(obterPagina, identidadeFixa, signal);
  const arquivo = await gerar(projetarFotografiaExportacao(snapshot, filtroFixo));
  signal?.throwIfAborted();
  await confirmarSnapshotExportacao(obterPagina, identidadeFixa, snapshot, signal);
  signal?.throwIfAborted();
  return arquivo;
}
