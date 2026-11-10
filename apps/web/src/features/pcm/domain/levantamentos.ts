export interface LinhaDependenciaLevantamento {
  id: string;
  estado: "em_conferencia" | "aprovada" | "rejeitada";
  dependencias: readonly string[];
}

/** Prévia local: não autoriza, aprova ou incorpora linhas; servidor deve revalidar o lote. */
export function preverDependenciasLevantamento(
  linhas: readonly LinhaDependenciaLevantamento[],
  selecionadas: readonly string[],
): { elegiveis: string[]; bloqueadas: { id: string; motivo: string; dependencia: string }[] } {
  const porId = new Map<string, LinhaDependenciaLevantamento>();
  for (const linha of linhas) {
    if (!linha.id.trim() || porId.has(linha.id)) throw new Error("Identidade de linha inválida.");
    porId.set(linha.id, linha);
  }
  const selecionadasSet = new Set(selecionadas);
  if (selecionadasSet.size !== selecionadas.length) throw new Error("Seleção duplicada.");
  for (const id of selecionadas) {
    if (porId.get(id)?.estado !== "em_conferencia") throw new Error("Seleção inválida.");
  }
  const elegiveis: string[] = [];
  const concluido = new Set<string>();
  const visitando = new Set<string>();
  const bloqueadas = new Map<string, { id: string; motivo: string; dependencia: string }>();
  for (const raiz of selecionadas) {
    if (concluido.has(raiz)) continue;
    const pilha = [{ id: raiz, indice: 0 }];
    visitando.add(raiz);
    while (pilha.length) {
      const atual = pilha[pilha.length - 1];
      if (!atual) throw new Error("Pilha de dependências inválida.");
      const linha = porId.get(atual.id);
      if (!linha) throw new Error("Identidade de linha inválida.");
      if (atual.indice >= linha.dependencias.length) {
        visitando.delete(atual.id);
        concluido.add(atual.id);
        elegiveis.push(atual.id);
        pilha.pop();
        continue;
      }
      const dependencia = linha.dependencias[atual.indice];
      if (dependencia === undefined) throw new Error("Dependência inválida.");
      const pai = porId.get(dependencia);
      let motivo: string | null = null;
      if (!pai) motivo = "referencia_ausente";
      else if (pai.estado === "aprovada") {
        atual.indice++;
        continue;
      } else if (pai.estado !== "em_conferencia" || !selecionadasSet.has(dependencia))
        motivo = "dependencia_nao_aprovada";
      else if (visitando.has(dependencia) || bloqueadas.has(dependencia))
        motivo = "dependencia_bloqueada";
      else if (concluido.has(dependencia)) {
        atual.indice++;
        continue;
      } else {
        visitando.add(dependencia);
        pilha.push({ id: dependencia, indice: 0 });
        continue;
      }
      bloqueadas.set(atual.id, { id: atual.id, motivo, dependencia });
      visitando.delete(atual.id);
      concluido.add(atual.id);
      pilha.pop();
    }
  }
  return { elegiveis, bloqueadas: selecionadas.flatMap((id) => bloqueadas.get(id) ?? []) };
}
