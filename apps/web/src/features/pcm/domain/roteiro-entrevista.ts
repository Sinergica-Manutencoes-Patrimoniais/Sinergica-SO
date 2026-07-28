// domain/roteiro-entrevista.ts — E02-S26. Roteiro configurável do agente entrevistador de
// cadastro. Mesmo formato de pergunta já usado pelo fluxo comercial (PassoFluxo, E02-S07/S08) —
// reaproveitado aqui pra não inventar um 2º schema de checklist configurável.

export interface PerguntaRoteiro {
  campo: string;
  pergunta: string;
  obrigatorio: boolean;
}

export interface RoteiroEntrevista {
  id: string;
  nome: string;
  ativo: boolean;
  perguntas: PerguntaRoteiro[];
}

export interface RoteiroFormData {
  nome: string;
  perguntas: PerguntaRoteiro[];
}

/** Nome e ao menos 1 pergunta com campo+texto são obrigatórios — sem isso não há entrevista. */
export function validarRoteiro(input: RoteiroFormData): RoteiroFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome do roteiro é obrigatório.");
  if (input.perguntas.length === 0) {
    throw new Error("O roteiro precisa de pelo menos uma pergunta.");
  }
  const perguntas = input.perguntas.map((pergunta, indice) => {
    const campo = pergunta.campo.trim();
    const texto = pergunta.pergunta.trim();
    if (!campo) throw new Error(`Pergunta ${indice + 1}: campo é obrigatório.`);
    if (!texto) throw new Error(`Pergunta ${indice + 1}: texto da pergunta é obrigatório.`);
    return { campo, pergunta: texto, obrigatorio: pergunta.obrigatorio };
  });
  return { nome, perguntas };
}
