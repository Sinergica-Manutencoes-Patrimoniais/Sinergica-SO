// memoria-cliente.ts — E02-S24. Composição do contexto de memória/alma por cliente — pura, sem
// I/O. Quem busca alma/resumo (por `clienteId`) é responsabilidade do chamador; isolamento entre
// clientes (AC-4) é garantido por nunca misturar dados de dois `clienteId` numa mesma chamada.

/** AC-1: uma só string, pronta pra entrar no bloco de conhecimento do prompt (`comporPromptPersona`).
 * Alma vazia/ausente e resumo vazio/ausente não geram seção — evita ruído no prompt pra cliente
 * novo sem histórico. */
export function comporContextoCliente(
  alma: string | null | undefined,
  resumo: string | null | undefined,
): string | null {
  const partes: string[] = [];
  const almaTrim = alma?.trim();
  if (almaTrim) partes.push(`Sobre este cliente: ${almaTrim}`);
  const resumoTrim = resumo?.trim();
  if (resumoTrim) partes.push(`Resumo das conversas anteriores: ${resumoTrim}`);
  return partes.length > 0 ? partes.join("\n\n") : null;
}

// ── E02-S24 AC-2/AC-3: janela crua × resumo rolante ───────────────────────────────────────────
// Porte do TriviAtende (`modules/agente/domain/fonte-de-conhecimento.ts`): lá o agente separa o
// que está "quente" (lido cru) do que já virou conhecimento consolidado. Aqui a mesma ideia com o
// vocabulário da Sinérgica — a janela crua é o último mês de `atendimento.mensagens`; o que saiu
// dela e ainda está dentro da retenção vira o resumo rolante de `cliente_memoria_resumo`.

/** Último mês lido cru pelo Zé (AC-2). */
export const JANELA_CRUA_DIAS = 30;
/** Até onde o resumo rolante alcança para trás (AC-3, "~2–3 meses"). Mensagem mais antiga que
 * isto sai do contexto do Zé — não é apagada do banco (ver SPEC_DEVIATION de retenção). */
export const RETENCAO_RESUMO_DIAS = 90;

export interface LimitesMemoria {
  /** Tudo a partir daqui é lido cru pelo agente. */
  janelaCruaDesde: Date;
  /** Piso do resumo rolante — mensagem anterior a isto não entra em lugar nenhum. */
  resumoDesde: Date;
}

export function limitesMemoria(
  agora: Date,
  janelaCruaDias = JANELA_CRUA_DIAS,
  retencaoDias = RETENCAO_RESUMO_DIAS,
): LimitesMemoria {
  const dia = 24 * 60 * 60 * 1000;
  return {
    janelaCruaDesde: new Date(agora.getTime() - janelaCruaDias * dia),
    resumoDesde: new Date(agora.getTime() - retencaoDias * dia),
  };
}

export interface MensagemParaResumo {
  criadoEm: string;
  autor: string;
  conteudo: string | null;
}

/** AC-3: só o que já SAIU da janela crua e ainda está dentro da retenção entra no resumo — sem
 * isso o resumo duplicaria o que o agente já lê cru, gastando budget duas vezes com o mesmo dado. */
export function selecionarMensagensParaResumo(
  mensagens: readonly MensagemParaResumo[],
  limites: LimitesMemoria,
): MensagemParaResumo[] {
  return mensagens
    .filter((m) => {
      const quando = new Date(m.criadoEm).getTime();
      if (Number.isNaN(quando)) return false;
      if (!m.conteudo?.trim()) return false;
      return quando >= limites.resumoDesde.getTime() && quando < limites.janelaCruaDesde.getTime();
    })
    .sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());
}

/** Transcrição enviada ao LLM para virar resumo. Trunca pelo começo (descarta o mais antigo e
 * mantém o mais recente, que é o que ainda pesa no atendimento de hoje). */
export function montarTextoParaResumo(
  mensagens: readonly MensagemParaResumo[],
  maxChars = 20_000,
): string {
  const linhas = mensagens.map(
    (m) => `[${m.criadoEm.slice(0, 10)}] ${m.autor}: ${(m.conteudo ?? "").trim()}`,
  );
  let texto = linhas.join("\n");
  while (texto.length > maxChars && linhas.length > 1) {
    linhas.shift();
    texto = linhas.join("\n");
  }
  return texto.slice(0, maxChars);
}

/** Caso de borda da spec: "contexto excede budget → prioriza alma + janela crua mais recente;
 * trunca resumo, com log". A alma nunca é truncada (é curta, e é a instrução de COMO falar com
 * este cliente); quem cede espaço é o resumo. Devolve também se houve truncagem, pra quem chama
 * logar — truncar em silêncio é como o contexto fica errado sem ninguém perceber. */
export function comporContextoClienteComOrcamento(
  alma: string | null | undefined,
  resumo: string | null | undefined,
  orcamentoChars: number,
): { contexto: string | null; resumoTruncado: boolean } {
  const almaTrim = alma?.trim() ?? "";
  const resumoTrim = resumo?.trim() ?? "";
  if (!resumoTrim) {
    return { contexto: comporContextoCliente(almaTrim, null), resumoTruncado: false };
  }

  const completo = comporContextoCliente(almaTrim, resumoTrim);
  if (completo !== null && completo.length <= orcamentoChars) {
    return { contexto: completo, resumoTruncado: false };
  }
  const semResumo = comporContextoCliente(almaTrim, null) ?? "";
  const rotulo = "\n\nResumo das conversas anteriores: ";
  const sobra = orcamentoChars - semResumo.length - rotulo.length;
  if (sobra <= 0) return { contexto: semResumo || null, resumoTruncado: true };
  return {
    contexto: comporContextoCliente(almaTrim, resumoTrim.slice(0, sobra)),
    resumoTruncado: true,
  };
}
