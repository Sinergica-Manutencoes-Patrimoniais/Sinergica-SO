// domain/trigger-automatico.ts — E02-S25 AC-5/AC-6. Regra de validação da configuração do
// trigger de resposta automática do Zé. Sem I/O, sem framework.
//
// Espelha `supabase/functions/_shared/trigger-automatico.ts` (que decide em runtime, no Deno) —
// as duas cópias existem porque front e Edge Function não compartilham módulo neste monorepo, e
// a duplicação aqui é só de REGRA DE FORMULÁRIO, nunca da matriz de decisão.

export const DIAS_DA_SEMANA = [
  { valor: 0, rotulo: "Domingo" },
  { valor: 1, rotulo: "Segunda" },
  { valor: 2, rotulo: "Terça" },
  { valor: 3, rotulo: "Quarta" },
  { valor: 4, rotulo: "Quinta" },
  { valor: 5, rotulo: "Sexta" },
  { valor: 6, rotulo: "Sábado" },
] as const;

/** Dia sem janela = sem atendimento humano o dia inteiro (AC-6). É por isso que `inicio`/`fim`
 * são opcionais: "domingo vazio" é configuração legítima, não formulário incompleto. */
export interface JanelaDiaForm {
  dia: number;
  inicio: string;
  fim: string;
}

export interface TriggerAutomaticoFormData {
  ativo: boolean;
  minMinutosSemResposta: number;
  janelas: JanelaDiaForm[];
}

export interface TriggerAutomaticoValidado {
  ativo: boolean;
  minMinutosSemResposta: number;
  janelas: JanelaDiaForm[];
}

const MINUTOS_MAXIMO = 24 * 60;

/** Descarta os dias em branco e valida o que sobrou. Lança com mensagem em PT-BR — a tela mostra
 * a mensagem como está. */
export function validarTriggerAutomatico(
  input: TriggerAutomaticoFormData,
): TriggerAutomaticoValidado {
  const janelas: JanelaDiaForm[] = [];
  for (const janela of input.janelas) {
    const inicio = janela.inicio.trim();
    const fim = janela.fim.trim();
    if (!inicio && !fim) continue; // dia sem atendimento humano — legítimo
    if (!inicio || !fim) {
      throw new Error(
        `Informe início e fim juntos em ${rotuloDoDia(janela.dia)}, ou deixe o dia inteiro em branco.`,
      );
    }
    if (fim <= inicio) {
      throw new Error(`O fim precisa ser depois do início em ${rotuloDoDia(janela.dia)}.`);
    }
    if (janelas.some((j) => j.dia === janela.dia)) {
      throw new Error(`${rotuloDoDia(janela.dia)} aparece duas vezes.`);
    }
    janelas.push({ dia: janela.dia, inicio, fim });
  }

  if (!Number.isInteger(input.minMinutosSemResposta) || input.minMinutosSemResposta <= 0) {
    throw new Error(
      "Os minutos sem resposta humana precisam ser um número inteiro maior que zero.",
    );
  }
  if (input.minMinutosSemResposta > MINUTOS_MAXIMO) {
    throw new Error("Os minutos sem resposta humana não podem passar de 24 horas (1440).");
  }
  // AC-1 continua valendo com zero janelas: sem nenhum horário humano, o Zé assume o tempo todo.
  // Isso é uma escolha, não um erro — quem avisa que é escolha é `faltaParaAtivarTrigger`.
  return { ativo: input.ativo, minMinutosSemResposta: input.minMinutosSemResposta, janelas };
}

/** Porte do `faltaParaAtivar` do TriviAtende: diz O QUE falta, em vez de um botão desabilitado
 * sem explicação. Aqui não bloqueia o salvamento — avisa o efeito de salvar assim. */
export function faltaParaAtivarTrigger(input: TriggerAutomaticoFormData): string[] {
  const avisos: string[] = [];
  const comHorario = input.janelas.filter((j) => j.inicio.trim() && j.fim.trim());
  if (comHorario.length === 0) {
    avisos.push(
      "Nenhum dia tem horário de atendimento humano — o Zé vai responder sozinho o tempo todo.",
    );
  }
  if (!input.ativo) {
    avisos.push("O trigger está desligado: nada abaixo tem efeito até você ligá-lo.");
  }
  return avisos;
}

export function rotuloDoDia(dia: number): string {
  return DIAS_DA_SEMANA.find((d) => d.valor === dia)?.rotulo ?? `Dia ${dia}`;
}
