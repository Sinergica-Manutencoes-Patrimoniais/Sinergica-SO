import { chaveIdentidade } from "./capacidade-por-tecnico";

/** Minutos declarados em propostas de continuidade, sem somar aos HH de outras fontes. */
export function consolidarEsforcoContinuacoes(fontes: readonly {
  osId: string; propostaId: string | null; minutos: number | null; podeSomar: boolean;
}[]) {
  const grupos = new Map<string, { propostas: Set<string>; valores: Set<number>; elegibilidade: Set<boolean>; possuiAusente: boolean }>();
  for (const f of fontes) {
    if (!f.osId || (f.propostaId === null) !== (f.minutos === null) ||
      (f.propostaId !== null && (!f.propostaId || typeof f.minutos !== "number" || !Number.isSafeInteger(f.minutos) || f.minutos < 1))) throw new Error("Continuidade inválida.");
    if (typeof f.podeSomar !== "boolean") throw new Error("Continuidade inválida.");
    const osId = chaveIdentidade(f.osId);
    const grupo = grupos.get(osId) ?? { propostas: new Set<string>(), valores: new Set<number>(), elegibilidade: new Set<boolean>(), possuiAusente: false };
    if (f.propostaId === null || f.minutos === null) grupo.possuiAusente = true;
    else { grupo.propostas.add(chaveIdentidade(f.propostaId)); grupo.valores.add(f.minutos); }
    grupo.elegibilidade.add(f.podeSomar); grupos.set(osId, grupo);
  }
  let minutos = 0; let conflitos = 0; let ordens = 0;
  for (const grupo of grupos.values()) {
    if (grupo.propostas.size === 0) continue;
    if (grupo.possuiAusente || grupo.propostas.size !== 1 || grupo.valores.size !== 1 || grupo.elegibilidade.size !== 1) { conflitos++; continue; }
    if (!grupo.elegibilidade.has(true)) continue;
    const valor = [...grupo.valores][0]!;
    if (!Number.isSafeInteger(minutos + valor)) throw new Error("Subtotal excede limite.");
    minutos += valor; ordens++;
  }
  return { minutos, ordens, conflitos };
}

