export interface PassoFluxo {
  id: string;
  campo: string;
  pergunta: string;
  obrigatorio: boolean;
  ordem: number;
  x: number;
  y: number;
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
  };
}

/** Valida os passos antes de salvar — campo/pergunta não podem ficar vazios (nó "em branco" não
 * tem uso pra quem consome o fluxo em runtime). */
export function validarPassos(passos: readonly PassoFluxo[]): PassoFluxo[] {
  for (const passo of passos) {
    if (!passo.campo.trim()) throw new Error("Todo passo precisa de um nome de campo.");
    if (!passo.pergunta.trim()) throw new Error("Todo passo precisa de uma pergunta.");
  }
  return [...passos].sort((a, b) => a.ordem - b.ordem);
}
