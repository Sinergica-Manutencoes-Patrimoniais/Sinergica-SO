export interface PassoFluxo {
  id: string;
  campo: string;
  pergunta: string;
  obrigatorio: boolean;
  ordem: number;
  x: number;
  y: number;
  tipo?: "pergunta" | "decisao";
  condicao?: string;
  proximoIds?: string[];
}

export interface FluxoRecipe {
  id: string;
  nome: string;
  descricao: string;
  definicao: PassoFluxo[];
}

export interface FluxoLog {
  id: string;
  fluxoId: string;
  conversaId: string;
  nosPercorridos: string[];
  entrada: Record<string, unknown>;
  saida: Record<string, unknown>;
  createdAt: string;
}

export interface FluxoItem {
  id: string;
  personaId: string;
  nome: string;
  passos: PassoFluxo[];
  ativo: boolean;
}

export interface FluxoFormData {
  personaId: string;
  nome: string;
}

export function validarFluxo(input: FluxoFormData): FluxoFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome do fluxo é obrigatório.");
  if (!input.personaId) throw new Error("Persona é obrigatória.");
  return { nome, personaId: input.personaId };
}

/** Novo passo, posicionado abaixo do último (auto-layout vertical simples — o usuário pode
 * arrastar depois, a posição é só o ponto de partida). */
export function novoPasso(passosExistentes: readonly PassoFluxo[]): PassoFluxo {
  const ordem = passosExistentes.length;
  return {
    id: crypto.randomUUID(),
    campo: "",
    pergunta: "",
    obrigatorio: true,
    ordem,
    x: 100,
    y: ordem * 150,
    tipo: "pergunta",
    proximoIds: [],
  };
}

/** Valida os passos antes de salvar — campo/pergunta não podem ficar vazios (nó "em branco" não
 * tem uso pra quem consome o fluxo em runtime). */
export function validarPassos(passos: readonly PassoFluxo[]): PassoFluxo[] {
  for (const passo of passos) {
    if (!passo.campo.trim()) throw new Error("Todo passo precisa de um nome de campo.");
    if (!passo.pergunta.trim()) throw new Error("Todo passo precisa de uma pergunta.");
  }
  const ordenados = [...passos].sort((a, b) => a.ordem - b.ordem);
  if (ordenados.length < 2) return ordenados;
  const ids = new Set(ordenados.map((passo) => passo.id));
  const temArestaExplicita = ordenados.some((passo) => (passo.proximoIds?.length ?? 0) > 0);
  if (!temArestaExplicita) return ordenados;

  for (const passo of ordenados) {
    for (const destino of passo.proximoIds ?? []) {
      if (!ids.has(destino)) throw new Error("O fluxo contém uma conexão para nó inexistente.");
    }
  }
  const alcancados = new Set<string>();
  const visitando = new Set<string>();
  function visitar(id: string) {
    if (visitando.has(id)) throw new Error("O fluxo não pode conter ciclos.");
    if (alcancados.has(id)) return;
    visitando.add(id);
    const passo = ordenados.find((item) => item.id === id);
    for (const destino of passo?.proximoIds ?? []) visitar(destino);
    visitando.delete(id);
    alcancados.add(id);
  }
  visitar(ordenados[0]?.id as string);
  if (alcancados.size !== ordenados.length) throw new Error("O fluxo contém nó órfão.");
  return ordenados;
}

export function copiarRecipe(recipe: FluxoRecipe): PassoFluxo[] {
  const ids = new Map(recipe.definicao.map((passo) => [passo.id, crypto.randomUUID()]));
  return recipe.definicao.map((passo) => ({
    ...passo,
    id: ids.get(passo.id) as string,
    proximoIds: (passo.proximoIds ?? []).map((id) => ids.get(id) as string),
  }));
}
