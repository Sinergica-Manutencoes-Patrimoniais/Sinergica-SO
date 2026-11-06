/** Pré-conferência local. Não registra evidências nem autoriza uma onda. */
export type EvidenciaCenario = {
  cenario: string;
  clienteId: string;
  versao: string;
  ambiente: string;
  executor: string;
  data: string;
  identificadores: readonly string[];
  resultado: "passou" | "falhou" | "bloqueado";
  anexos: readonly string[];
  ressalva: string;
};

export type OndaPiloto = {
  id: number;
  nome: string;
  cenarios: readonly string[];
  verificacoes: readonly string[];
};

/** Mapeamento das ondas documentadas; não substitui a matriz CT completa. */
export const ONDAS_PILOTO: readonly OndaPiloto[] = [
  { id: 1, nome: "Guainumbí: estrutura e códigos", cenarios: ["CT-012", "CT-013", "CT-014", "CT-015"], verificacoes: ["Árvore e busca sem duplicidade", "Validação cadastral"] },
  { id: 2, nome: "Guainumbí: Chamado, OS, Visita e agenda", cenarios: ["CT-001", "CT-002", "CT-003", "CT-004", "CT-005", "CT-006", "CT-007", "CT-008", "CT-009", "CT-010", "CT-011"], verificacoes: ["Envio controlado e contrato T−24"] },
  { id: 3, nome: "Rimini e I Home: Planos e Rotinas", cenarios: [], verificacoes: ["Plano e versionamento", "Calendário e feriados", "Tempos pendentes explícitos", "Questionários"] },
  { id: 4, nome: "Guainumbí: Pendências, Backlog e campo", cenarios: ["CT-016", "CT-017", "CT-018", "CT-019", "CT-020", "CT-021"], verificacoes: ["Rastreabilidade e ausência de duplicidade"] },
  { id: 5, nome: "Materiais, aquisição e orçamento", cenarios: ["CT-022", "CT-023", "CT-025"], verificacoes: ["Cliente piloto autorizado", "Aquisição e orçamento"] },
  { id: 6, nome: "A Faturar, Portal e permissões", cenarios: ["CT-024", "CT-026", "CT-027", "CT-028", "CT-029"], verificacoes: ["Cliente piloto autorizado", "Segurança e ausência de cobrança duplicada"] },
];

export type ResultadoConferencia = {
  cenariosPendentes: string[];
  cenariosComFalha: string[];
  verificacoesPendentes: string[];
  prontoParaRevisao: boolean;
};

/**
 * Apenas identifica lacunas no contexto informado. Resultado positivo não é aceite,
 * não verifica autenticidade de anexos e não libera produção ou chamadas externas.
 */
export function conferirOnda(
  onda: OndaPiloto,
  contexto: { clienteId: string; versao: string; ambiente: string },
  evidencias: readonly EvidenciaCenario[],
  verificacoesConcluidas: readonly string[],
): ResultadoConferencia {
  const completos = (e: EvidenciaCenario) =>
    e.clienteId === contexto.clienteId && e.versao === contexto.versao && e.ambiente === contexto.ambiente &&
    [e.clienteId, e.versao, e.ambiente, e.executor].every((v) => v.trim().length > 0) &&
    Number.isFinite(Date.parse(e.data)) && e.identificadores.some((v) => v.trim().length > 0) &&
    e.anexos.some((v) => v.trim().length > 0) && typeof e.ressalva === "string";
  const cenariosPendentes: string[] = [];
  const cenariosComFalha: string[] = [];
  for (const cenario of onda.cenarios) {
    const correspondentes = evidencias.filter((e) => e.cenario === cenario && e.clienteId === contexto.clienteId &&
      e.versao === contexto.versao && e.ambiente === contexto.ambiente);
    const datasInvalidas = correspondentes.some((e) => !Number.isFinite(Date.parse(e.data)));
    const datadas = correspondentes.filter((e) => Number.isFinite(Date.parse(e.data)));
    if (!datadas.length) { cenariosPendentes.push(cenario); continue; }
    // Evita expandir uma lista grande em argumentos da função.
    const ultimaData = datadas.reduce((maior, e) => Math.max(maior, Date.parse(e.data)), Number.NEGATIVE_INFINITY);
    const ultimas = datadas.filter((e) => Date.parse(e.data) === ultimaData);
    // Uma declaração recente incompleta não pode ser ignorada em favor de aprovação antiga.
    if (datasInvalidas || ultimas.some((e) => !completos(e))) cenariosPendentes.push(cenario);
    if (ultimas.some((e) => e.resultado !== "passou")) cenariosComFalha.push(cenario);
  }
  const concluidas = new Set(verificacoesConcluidas);
  const verificacoesPendentes = onda.verificacoes.filter((item) => !concluidas.has(item));
  return { cenariosPendentes, cenariosComFalha, verificacoesPendentes,
    // Uma onda sem cenários mapeados não tem evidência suficiente para passar.
    prontoParaRevisao: onda.cenarios.length > 0 && !!contexto.clienteId.trim() && !!contexto.versao.trim() && !!contexto.ambiente.trim() &&
      !cenariosPendentes.length && !cenariosComFalha.length && !verificacoesPendentes.length };
}
