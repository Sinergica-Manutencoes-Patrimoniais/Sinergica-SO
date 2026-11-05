type Disponibilidade = { funcionarioId: string; disponiveisMinutos: number | null };
type Participacao = { id: string; funcionarioId: string; estimativaMinutos: number | null };
type Linha = {
  funcionarioId: string;
  disponibilidade: number | null;
  participacoes: number;
  estimativasPendentes: number;
  estimativaCompleta: number | null;
};

export const chaveIdentidade = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id.toLowerCase()
    : id;

/** Preserva o tipo da origem e normaliza somente o UUID que a identifica. */
export const chaveOrigem = (id: string) => {
  const separador = id.lastIndexOf(":");
  return separador < 0
    ? chaveIdentidade(id)
    : id.slice(0, separador + 1) + chaveIdentidade(id.slice(separador + 1));
};

/** Relação informativa: não comprova execução, cobertura, nem saldo operacional. */
export function agruparCapacidadePorTecnico(
  disponibilidades: readonly Disponibilidade[],
  participacoes: readonly Participacao[],
): Linha[] {
  const linhas = new Map<string, Linha>();
  const vistos = new Set<string>();
  for (const d of disponibilidades) {
    const tecnico = chaveIdentidade(d.funcionarioId);
    if (
      !d.funcionarioId ||
      linhas.has(tecnico) ||
      (d.disponiveisMinutos !== null &&
        (!Number.isSafeInteger(d.disponiveisMinutos) || d.disponiveisMinutos < 0))
    )
      throw new Error("Disponibilidade inválida.");
    linhas.set(tecnico, {
      funcionarioId: d.funcionarioId,
      disponibilidade: d.disponiveisMinutos,
      participacoes: 0,
      estimativasPendentes: 0,
      estimativaCompleta: null,
    });
  }
  for (const p of participacoes) {
    const participacao = chaveIdentidade(p.id);
    const tecnico = chaveIdentidade(p.funcionarioId);
    if (
      !p.id ||
      !p.funcionarioId ||
      vistos.has(participacao) ||
      (p.estimativaMinutos !== null &&
        (!Number.isSafeInteger(p.estimativaMinutos) || p.estimativaMinutos <= 0))
    )
      throw new Error("Participação inválida.");
    vistos.add(participacao);
    const linha = linhas.get(tecnico) ?? {
      funcionarioId: p.funcionarioId,
      disponibilidade: null,
      participacoes: 0,
      estimativasPendentes: 0,
      estimativaCompleta: null,
    };
    linha.participacoes++;
    if (p.estimativaMinutos === null) linha.estimativasPendentes++;
    else {
      const soma = (linha.estimativaCompleta ?? 0) + p.estimativaMinutos;
      if (!Number.isSafeInteger(soma)) throw new Error("Estimativa excede precisão segura.");
      linha.estimativaCompleta = soma;
    }
    linhas.set(tecnico, linha);
  }
  return [...linhas.values()]
    .map((l) => (l.estimativasPendentes ? { ...l, estimativaCompleta: null } : l))
    .sort((a, b) => a.funcionarioId.localeCompare(b.funcionarioId));
}
