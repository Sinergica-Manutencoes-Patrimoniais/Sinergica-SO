/** Domínio do funil comercial (E03-S01). Sem I/O, sem framework — a fonte da verdade das regras
 * que a UI e o banco precisam concordar.
 *
 * Espelha, em TypeScript, o que o trigger `comercial.fn_oportunidade_fechamento` (migration 0176)
 * garante no banco. A duplicação é deliberada: o banco garante que o dado existe, o domínio dá a
 * mensagem boa antes do round-trip. Se as duas divergirem, o banco vence — e o teste de
 * `transicaoInvalida` existe para essa divergência aparecer cedo. */

export type EtapaTipo = "aberta" | "ganha" | "perdida";

export interface Etapa {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
  tipo: EtapaTipo;
  ativo: boolean;
}

export interface MotivoPerda {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface Oportunidade {
  id: string;
  clienteId: string;
  etapaId: string;
  titulo: string;
  descricao: string | null;
  valorEstimadoCentavos: number | null;
  score: number | null;
  resumo: string | null;
  origem: string | null;
  leadTier: string | null;
  clusterNome: string | null;
  conversaId: string | null;
  responsavelId: string | null;
  motivoPerdaId: string | null;
  fechadaEm: string | null;
  criadaEm: string;
}

/** Etapas ativas em ordem de exibição. A ordenação é do domínio (e não um `order by` solto no
 * adapter) porque board, seletor e dashboard precisam concordar sobre o que é "a próxima etapa". */
export function etapasVisiveis(etapas: Etapa[]): Etapa[] {
  return etapas.filter((e) => e.ativo).sort((a, b) => a.ordem - b.ordem);
}

/** Onde uma oportunidade nasce quando ninguém escolheu etapa.
 * Lança em vez de devolver `undefined`: funil sem etapa aberta é configuração inválida, e falhar
 * aqui com mensagem clara é melhor do que criar oportunidade numa etapa terminal. */
export function etapaPadrao(etapas: Etapa[]): Etapa {
  const aberta = etapasVisiveis(etapas).find((e) => e.tipo === "aberta");
  if (!aberta) {
    throw new Error(
      "Nenhuma etapa aberta ativa no funil — configure ao menos uma antes de criar oportunidades.",
    );
  }
  return aberta;
}

export function exigeMotivo(etapa: Etapa): boolean {
  return etapa.tipo === "perdida";
}

export function etapaTerminal(etapa: Etapa): boolean {
  return etapa.tipo === "ganha" || etapa.tipo === "perdida";
}

/** Etapa inativa continua aparecendo como origem (há oportunidade dentro dela) mas não recebe
 * card novo — senão desativar uma etapa não significaria nada. */
export function podeReceberCard(etapa: Etapa): boolean {
  return etapa.ativo;
}

export interface Transicao {
  destino: Etapa;
  motivoPerdaId?: string | null;
}

/** Valida uma mudança de etapa. Devolve `null` quando é válida, ou a mensagem do problema —
 * formato escolhido para a UI decidir como mostrar (toast, inline, modal) sem try/catch. */
export function transicaoInvalida({ destino, motivoPerdaId }: Transicao): string | null {
  if (!podeReceberCard(destino)) {
    return `A etapa "${destino.nome}" está desativada e não recebe oportunidades.`;
  }
  if (exigeMotivo(destino) && !motivoPerdaId) {
    return "Informe o motivo da perda para mover a oportunidade para esta etapa.";
  }
  return null;
}

/** O que muda na oportunidade ao entrar na etapa de destino — o mesmo cálculo do trigger 0176.
 * Voltar para etapa aberta reabre: limpa fechamento E motivo, senão sobra motivo de perda numa
 * oportunidade que está de novo em negociação. */
export function aplicarTransicao(
  destino: Etapa,
  motivoPerdaId: string | null,
  agora: Date = new Date(),
): Pick<Oportunidade, "etapaId" | "motivoPerdaId" | "fechadaEm"> {
  if (etapaTerminal(destino)) {
    return {
      etapaId: destino.id,
      motivoPerdaId: destino.tipo === "perdida" ? motivoPerdaId : null,
      fechadaEm: agora.toISOString(),
    };
  }
  return { etapaId: destino.id, motivoPerdaId: null, fechadaEm: null };
}

/** Recusa desativar a última etapa aberta — sem ela não há onde nascer oportunidade (AC-7 da S02,
 * já aplicado aqui porque a configuração de etapas nasce nesta story). */
export function podeDesativarEtapa(etapa: Etapa, etapas: Etapa[]): string | null {
  if (etapa.tipo !== "aberta") return null;
  const outrasAbertas = etapas.filter((e) => e.ativo && e.tipo === "aberta" && e.id !== etapa.id);
  if (outrasAbertas.length === 0) {
    return "Esta é a última etapa aberta do funil — o funil precisa de ao menos uma.";
  }
  return null;
}

export function validarTituloOportunidade(titulo: string): string {
  const limpo = titulo.trim();
  if (!limpo) throw new Error("Título da oportunidade é obrigatório.");
  return limpo;
}

/** Centavos, nunca float — mesma regra do Financeiro. Vazio vira `null` (valor desconhecido),
 * que é diferente de zero (negócio sem valor). */
export function validarValorEstimado(valor: number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  if (!Number.isInteger(valor)) {
    throw new Error("Valor estimado deve estar em centavos inteiros.");
  }
  if (valor < 0) throw new Error("Valor estimado não pode ser negativo.");
  return valor;
}
