type Linha = { chave: string; tipo: string; atributos: { nome: string; referenciaPai?: string } };
export type AvisoRecepcao = { chave: string; codigo: "pai_nao_localizado_no_lote" | "ciclo_local" | "possivel_duplicidade" | "tipo_pai_incompativel"; mensagem: string };

// Espelha a guarda de aprovação parcial; a referência externa continua dependente de conferência no servidor.
const tiposPai: Record<string, readonly string[]> = {
  area: [], local: ["area"], sublocal: ["local", "sublocal"],
  sistema: ["area", "local", "sublocal"], equipamento: ["local", "sublocal"],
  grupo_quantitativo: ["local", "sublocal"], componente: ["local", "sublocal", "equipamento"],
};

/** Diagnóstico apenas do lote digitado; referências externas e duplicidades oficiais exigem consulta posterior. */
export function diagnosticarRecepcao(linhas: readonly Linha[]): AvisoRecepcao[] {
  const avisos: AvisoRecepcao[] = [];
  const porChave = new Map(linhas.map((linha) => [linha.chave, linha]));
  const nomes = new Map<string, string[]>();
  for (const linha of linhas) {
    const nome = linha.atributos.nome.trim().toLocaleLowerCase("pt-BR");
    const indice = JSON.stringify([linha.tipo, nome]);
    const existentes = nomes.get(indice) ?? [];
    existentes.push(linha.chave);
    nomes.set(indice, existentes);
    const pai = linha.atributos.referenciaPai?.trim();
    if (pai && !porChave.has(pai)) avisos.push({ chave: linha.chave, codigo: "pai_nao_localizado_no_lote", mensagem: "Referência não encontrada neste lote; confira se pertence ao cadastro existente." });
    const paiLocal = pai ? porChave.get(pai) : undefined;
    if (pai && (linha.tipo === "area" || (paiLocal && tiposPai[linha.tipo] && !tiposPai[linha.tipo]!.includes(paiLocal.tipo)))) {
      avisos.push({ chave: linha.chave, codigo: "tipo_pai_incompativel", mensagem: linha.tipo === "area"
        ? "Área não admite referência de pai na aprovação atual."
        : `O tipo ${paiLocal!.tipo} não é aceito como pai de ${linha.tipo} na aprovação atual.` });
    }
  }
  for (const iguais of nomes.values()) {
    if (iguais.length > 1) for (const chave of iguais) avisos.push({ chave, codigo: "possivel_duplicidade", mensagem: "Mesmo nome e tipo aparecem mais de uma vez; confira se são itens distintos." });
  }
  for (const linha of linhas) {
    const visitados = new Set<string>();
    let atual: Linha | undefined = linha;
    while (atual) {
      if (visitados.has(atual.chave)) {
        avisos.push({ chave: linha.chave, codigo: "ciclo_local", mensagem: "A sequência de referências neste lote contém um ciclo; revise a hierarquia." });
        break;
      }
      visitados.add(atual.chave);
      const pai: string | undefined = atual.atributos.referenciaPai?.trim();
      atual = pai ? porChave.get(pai) : undefined;
    }
  }
  return avisos;
}
