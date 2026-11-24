// domain/agenda-projecao-visita.ts — E01-S202.
//
// A Agenda do Técnico deixa de ser cadastro e passa a ser PROJEÇÃO da Visita (Pacote Consolidado
// de 13/11/2026: "Agenda por técnico e calendário por cliente são projeções das mesmas Visitas,
// não cadastros paralelos"). Este módulo é puro: só tipos e agrupamento. A origem do dado é a RPC
// `pcm.sso_listar_agenda_tecnico_projetada` (migration 1867).

/** Período derivado da própria Visita, no fuso dela — não é campo editável de agenda. */
export type PeriodoVisita = "manha" | "tarde" | "integral";

export interface AlocacaoProjetada {
  visitaId: string;
  clienteId: string;
  clienteNome: string;
  funcionarioId: string;
  funcionarioNome: string;
  /** Papel na Visita; "Responsável" quando a Visita ainda não tem equipe montada. */
  papel: string;
  /** ISO yyyy-mm-dd, data local da Visita. */
  data: string;
  periodo: PeriodoVisita;
  estado: string;
  natureza: string;
  /** Números das OS vinculadas, na ordem da sequência da Visita. AC-2 do pacote: a agenda mostra
   * a Visita COM as OS — é o que elimina "a união posterior de Agenda e OS com deduplicação". */
  osNumeros: string[];
  quantidadeOs: number;
}

export const ROTULO_PERIODO: Record<PeriodoVisita, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  integral: "Dia inteiro",
};

/** Segunda-feira ISO da semana de `referencia`, em yyyy-mm-dd — é o que a RPC exige (e recusa
 * qualquer outro dia da semana, para a agenda nunca ficar desalinhada do quadro). */
export function inicioSemanaIso(referencia: Date): string {
  const dia = referencia.getDay(); // 0=dom..6=sáb
  const segunda = new Date(referencia);
  segunda.setDate(referencia.getDate() + (dia === 0 ? -6 : 1 - dia));
  segunda.setHours(12, 0, 0, 0); // meio-dia local evita a virada de fuso ao serializar
  return `${segunda.getFullYear()}-${String(segunda.getMonth() + 1).padStart(2, "0")}-${String(segunda.getDate()).padStart(2, "0")}`;
}

export interface LinhaTecnicoProjetada {
  funcionarioId: string;
  funcionarioNome: string;
  porDia: Map<string, AlocacaoProjetada[]>;
}

/** Linha por técnico, coluna por dia — mesmo formato da visão "Por técnico" que já existia, agora
 * alimentado pela Visita. Técnico sem alocação na semana não gera linha vazia. */
export function agruparProjecaoPorTecnico(
  alocacoes: readonly AlocacaoProjetada[],
  dias: readonly string[],
): LinhaTecnicoProjetada[] {
  const linhas = new Map<string, LinhaTecnicoProjetada>();
  for (const alocacao of alocacoes) {
    let linha = linhas.get(alocacao.funcionarioId);
    if (!linha) {
      linha = {
        funcionarioId: alocacao.funcionarioId,
        funcionarioNome: alocacao.funcionarioNome,
        porDia: new Map(dias.map((dia) => [dia, []])),
      };
      linhas.set(alocacao.funcionarioId, linha);
    }
    linha.porDia.get(alocacao.data)?.push(alocacao);
  }
  for (const linha of linhas.values()) {
    for (const lista of linha.porDia.values()) {
      lista.sort(
        (a, b) => a.periodo.localeCompare(b.periodo) || a.clienteNome.localeCompare(b.clienteNome),
      );
    }
  }
  return [...linhas.values()].sort((a, b) => a.funcionarioNome.localeCompare(b.funcionarioNome));
}

/** Agrupamento por dia, para a visão "Por dia" da mesma tela. */
export function agruparProjecaoPorDia(
  alocacoes: readonly AlocacaoProjetada[],
  dias: readonly string[],
): Map<string, AlocacaoProjetada[]> {
  const mapa = new Map<string, AlocacaoProjetada[]>(dias.map((dia) => [dia, []]));
  for (const alocacao of alocacoes) mapa.get(alocacao.data)?.push(alocacao);
  for (const lista of mapa.values()) {
    lista.sort(
      (a, b) =>
        a.funcionarioNome.localeCompare(b.funcionarioNome) || a.periodo.localeCompare(b.periodo),
    );
  }
  return mapa;
}

/** Motivos pelos quais a projeção pode não estar disponível. Cada um pede uma frase DIFERENTE —
 * confundir "desligado" com "semana sem Visita" é exatamente o engano que originou esta story. */
export type MotivoProjecaoIndisponivel =
  | "flag-desligada"
  | "gate-fechado"
  | "sem-capacidade"
  | "autorizacao-em-alteracao"
  | "erro";

export function motivoDoErroProjecao(erro: unknown): MotivoProjecaoIndisponivel {
  const mensagem =
    erro && typeof erro === "object"
      ? `${String((erro as { message?: unknown }).message ?? "")} ${String((erro as { code?: unknown }).code ?? "")}`
      : String(erro ?? "");
  if (mensagem.includes("agenda_capacidade_bloqueada")) return "gate-fechado";
  if (mensagem.includes("autorizacao_em_alteracao")) return "autorizacao-em-alteracao";
  if (mensagem.includes("sem_acesso") || mensagem.includes("42501")) return "sem-capacidade";
  return "erro";
}

export const FRASE_PROJECAO_INDISPONIVEL: Record<MotivoProjecaoIndisponivel, string> = {
  "flag-desligada": "Agenda projetada da Visita: recurso disponível, ainda não ativado.",
  "gate-fechado":
    "Agenda projetada da Visita: recurso disponível, ainda não ativado no banco (gate de capacidade da agenda fechado).",
  "sem-capacidade":
    "Você não tem a capacidade de confirmação de Visita em nenhum Cliente — por isso a agenda não pode ser montada.",
  "autorizacao-em-alteracao":
    "As permissões de Visita estão sendo alteradas agora. Tente novamente em alguns instantes.",
  erro: "Não foi possível montar a agenda projetada das Visitas.",
};

/** Frase do vazio legítimo — propositalmente diferente de todas as de cima. */
export const FRASE_SEMANA_SEM_VISITA =
  "Nenhuma Visita planejada nesta semana. A agenda do técnico deriva da Visita: planeje a Visita e ela aparece aqui.";

/** E01-S202 AC-7: a guarda do banco (`sso_agenda_tecnico_obsoleta`, migration 1867) recusa escrita
 * nova no cadastro manual. Quem está na tela precisa ler POR QUE o botão parou de funcionar e para
 * onde ir — erro cru do Postgres não é resposta. */
export function mensagemDeErroDeAlocacaoManual(erro: unknown): string {
  const texto =
    erro && typeof erro === "object"
      ? `${String((erro as { message?: unknown }).message ?? "")} ${String((erro as { hint?: unknown }).hint ?? "")}`
      : String(erro ?? "");
  if (texto.includes("agenda_tecnico_obsoleta"))
    return "O cadastro manual da Agenda do Técnico foi aposentado: a agenda passou a ser projeção da Visita. Planeje a Visita e a alocação aparece aqui.";
  return erro instanceof Error ? erro.message : "Não foi possível salvar a alocação.";
}
