export type EsforcoVisita = {
  osId: string;
  ocorrenciaId?: string | null;
  ocorrenciaIds?: readonly string[];
  podeSomar?: boolean;
  /** Minutos de continuidade não são HH comprovadas e não substituem a declaração integral. */
  continuidade?: boolean;
  revision: number;
  internosMinutos: number | null;
  terceirosMinutos: number | null;
  acompanhamentoMinutos: number | null;
};

function origensEquivalentes(a: EsforcoVisita, b: EsforcoVisita): boolean {
  const origensA = new Set([...(a.ocorrenciaIds ?? []), ...(a.ocorrenciaId ? [a.ocorrenciaId] : [])]);
  const origensB = new Set([...(b.ocorrenciaIds ?? []), ...(b.ocorrenciaId ? [b.ocorrenciaId] : [])]);
  return origensA.size === origensB.size && [...origensA].every((origem) => origensB.has(origem));
}

/** Somente registros carregados; não afirma cobertura da semana ou saldo. */
export function consolidarEsforcoVisitas(linhas: readonly EsforcoVisita[]) {
  const porOs = new Map<string, EsforcoVisita | null>();
  const osPorOcorrencia = new Map<string, Set<string>>();
  const normalizar = chaveOrigem;
  for (const original of linhas) {
    const linha = { ...original, osId: normalizar(original.osId),
      ocorrenciaId: original.ocorrenciaId ? normalizar(original.ocorrenciaId) : original.ocorrenciaId,
      ocorrenciaIds: original.ocorrenciaIds?.map(normalizar) };
    if (
      !linha.osId ||
      (linha.ocorrenciaId !== undefined && linha.ocorrenciaId !== null && !linha.ocorrenciaId) ||
      (linha.ocorrenciaIds?.some((id) => !id) ?? false) ||
      !Number.isSafeInteger(linha.revision) ||
      linha.revision < 0 ||
      [linha.internosMinutos, linha.terceirosMinutos, linha.acompanhamentoMinutos].some(
        (v) => v !== null && (!Number.isSafeInteger(v) || v < 0),
      )
    )
      throw new Error("Esforço inválido.");
    for (const origem of new Set([
      ...(linha.ocorrenciaIds ?? []),
      ...(linha.ocorrenciaId ? [linha.ocorrenciaId] : []),
    ])) {
      const os = osPorOcorrencia.get(origem) ?? new Set<string>();
      os.add(linha.osId);
      osPorOcorrencia.set(origem, os);
    }
    const anterior = porOs.get(linha.osId);
    if (anterior === undefined) porOs.set(linha.osId, linha);
    else if (
      anterior &&
      (!origensEquivalentes(anterior, linha) ||
        (anterior.podeSomar ?? true) !== (linha.podeSomar ?? true) ||
        (anterior.continuidade ?? false) !== (linha.continuidade ?? false) ||
        anterior.revision !== linha.revision ||
        anterior.internosMinutos !== linha.internosMinutos ||
        anterior.terceirosMinutos !== linha.terceirosMinutos ||
        anterior.acompanhamentoMinutos !== linha.acompanhamentoMinutos)
    )
      porOs.set(linha.osId, null);
  }
  for (const os of osPorOcorrencia.values()) {
    if (os.size > 1) for (const id of os) porOs.set(id, null);
  }
  let internosMinutos = 0;
  let terceirosMinutos = 0;
  let execucaoPropriaMinutos = 0;
  let acompanhamentoMinutos = 0;
  let estimativasIncompletas = 0;
  let origensPendentes = 0;
  let origensConflitantes = 0;
  let continuacoesPendentes = 0;
  for (const linha of porOs.values()) {
    if (!linha) {
      origensPendentes++;
      origensConflitantes++;
      continue;
    }
    // A declaração de HH e a de escopo ainda não comprovam execução ou esforço restante.
    origensPendentes++;
    if (linha.podeSomar === false) continue;
    if (linha.continuidade) {
      // Tempo declarado para continuidade não informa equipe própria nem terceiros.
      // Não contar a declaração integral como se fosse esforço restante.
      continuacoesPendentes++;
      estimativasIncompletas++;
      continue;
    }
    // Zero em uma categoria pode significar que ela não se aplica. Entretanto,
    // uma fonte inteiramente zerada não comprova estimativa de demanda (AC-3).
    if (linha.internosMinutos === null || linha.terceirosMinutos === null || linha.acompanhamentoMinutos === null ||
      (linha.internosMinutos === 0 && linha.terceirosMinutos === 0 && linha.acompanhamentoMinutos === 0)) estimativasIncompletas++;
    execucaoPropriaMinutos += linha.internosMinutos ?? 0;
    acompanhamentoMinutos += linha.acompanhamentoMinutos ?? 0;
    internosMinutos += (linha.internosMinutos ?? 0) + (linha.acompanhamentoMinutos ?? 0);
    terceirosMinutos += linha.terceirosMinutos ?? 0;
    if (![internosMinutos, terceirosMinutos, execucaoPropriaMinutos, acompanhamentoMinutos].every(Number.isSafeInteger))
      throw new Error("Esforço excede precisão segura.");
  }
  return { internosMinutos, terceirosMinutos, execucaoPropriaMinutos, acompanhamentoMinutos, estimativasIncompletas, origensPendentes, origensConflitantes,
    ...(continuacoesPendentes > 0 ? { continuacoesPendentes } : {}) };
}
import { chaveOrigem } from "./capacidade-por-tecnico";

/** Indica as identidades que precisam de conciliação, sem escolher automaticamente uma fonte. */
export function identificarConflitosEsforco(linhas: readonly EsforcoVisita[]) {
  const porOrigem = new Map<string, Set<string>>();
  for (const linha of linhas) {
    const os = chaveOrigem(linha.osId);
    if (!os) continue;
    const origens = new Set([...(linha.ocorrenciaIds ?? []), ...(linha.ocorrenciaId ? [linha.ocorrenciaId] : [])].map(chaveOrigem).filter(Boolean));
    for (const origem of origens) {
      const associadas = porOrigem.get(origem) ?? new Set<string>();
      associadas.add(os);
      porOrigem.set(origem, associadas);
    }
  }
  return [...porOrigem.entries()].filter(([, ordens]) => ordens.size > 1)
    .map(([origem, ordens]) => ({ origem, fontes: [...ordens].sort() }))
    .sort((a, b) => a.origem.localeCompare(b.origem));
}

