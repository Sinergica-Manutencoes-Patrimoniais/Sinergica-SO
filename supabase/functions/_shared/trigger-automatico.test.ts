import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  deveResponderAutomaticamente,
  faltaParaAtivarTriggerAutomatico,
  minutosAteAssumirPorInatividade,
} from "./trigger-automatico.ts";
import type { ConfigTriggerAutomatico } from "./trigger-automatico.ts";

const CONFIG_PADRAO: ConfigTriggerAutomatico = {
  ativo: true,
  dias: [1, 2, 3, 4, 5], // seg-sex
  janelaInicio: "08:00",
  janelaFim: "18:00",
  minMinutosSemResposta: 30,
};

// 2026-07-30 é quinta-feira
function horario(hora: number, minuto = 0): Date {
  return new Date(2026, 6, 30, hora, minuto);
}

Deno.test("trigger desligado nunca responde automático", () => {
  assertEquals(
    deveResponderAutomaticamente(
      { ...CONFIG_PADRAO, ativo: false },
      { agora: horario(22), minutosSemRespostaHumana: null, handoffAtivo: false },
    ),
    false,
  );
});

Deno.test("AC-1: fora do horário (noite) responde automático", () => {
  assertEquals(
    deveResponderAutomaticamente(CONFIG_PADRAO, {
      agora: horario(22),
      minutosSemRespostaHumana: null,
      handoffAtivo: false,
    }),
    true,
  );
});

Deno.test("dia sem expediente (fim de semana) responde automático o dia inteiro", () => {
  const sabado = new Date(2026, 7, 1, 10, 0); // sábado
  assertEquals(
    deveResponderAutomaticamente(CONFIG_PADRAO, {
      agora: sabado,
      minutosSemRespostaHumana: null,
      handoffAtivo: false,
    }),
    true,
  );
});

Deno.test("AC-2: dentro do horário, > X min sem resposta humana responde automático", () => {
  assertEquals(
    deveResponderAutomaticamente(CONFIG_PADRAO, {
      agora: horario(14),
      minutosSemRespostaHumana: 45,
      handoffAtivo: false,
    }),
    true,
  );
});

Deno.test("AC-4: dentro do horário, humano respondeu recente (<= X min) silencia", () => {
  assertEquals(
    deveResponderAutomaticamente(CONFIG_PADRAO, {
      agora: horario(14),
      minutosSemRespostaHumana: 5,
      handoffAtivo: false,
    }),
    false,
  );
});

Deno.test("dentro do horário sem dado de última resposta humana: silencia (conservador)", () => {
  assertEquals(
    deveResponderAutomaticamente(CONFIG_PADRAO, {
      agora: horario(14),
      minutosSemRespostaHumana: null,
      handoffAtivo: false,
    }),
    false,
  );
});

Deno.test("AC-3: handoff ativo sempre silencia, mesmo fora do horário", () => {
  assertEquals(
    deveResponderAutomaticamente(CONFIG_PADRAO, {
      agora: horario(22),
      minutosSemRespostaHumana: null,
      handoffAtivo: true,
    }),
    false,
  );
});

// ── AC-6: janela por dia da semana (migration 1881) ───────────────────────────────────────────

/** Instante exato no fuso de operação — as janelas são civis em America/Sao_Paulo, não UTC. */
function emSaoPaulo(iso: string): Date {
  return new Date(`${iso}-03:00`);
}

const CONFIG_POR_DIA: ConfigTriggerAutomatico = {
  ...CONFIG_PADRAO,
  dias: [],
  janelaInicio: null,
  janelaFim: null,
  janelas: [
    { dia: 1, inicio: "08:00", fim: "18:00" }, // segunda
    { dia: 6, inicio: "08:00", fim: "12:00" }, // sábado, meio período
  ],
};

Deno.test("AC-6: cada dia tem a sua janela — sábado 13h já é fora do horário", () => {
  // 2026-11-28 é sábado.
  assertEquals(
    deveResponderAutomaticamente(CONFIG_POR_DIA, {
      agora: emSaoPaulo("2026-11-28T13:00:00"),
      minutosSemRespostaHumana: 1,
      handoffAtivo: false,
    }),
    true,
  );
});

Deno.test("AC-6: mesmo horário na segunda ainda é dentro da janela — Zé silencia", () => {
  // 2026-11-30 é segunda.
  assertEquals(
    deveResponderAutomaticamente(CONFIG_POR_DIA, {
      agora: emSaoPaulo("2026-11-30T13:00:00"),
      minutosSemRespostaHumana: 1,
      handoffAtivo: false,
    }),
    false,
  );
});

Deno.test("AC-6: dia sem janela nenhuma (domingo) é fora do horário o dia inteiro", () => {
  // 2026-11-29 é domingo, e não há janela para o dia 0.
  assertEquals(
    deveResponderAutomaticamente(CONFIG_POR_DIA, {
      agora: emSaoPaulo("2026-11-29T10:00:00"),
      minutosSemRespostaHumana: 1,
      handoffAtivo: false,
    }),
    true,
  );
});

Deno.test("janela é civil no fuso de operação, não no fuso do processo (UTC)", () => {
  // 09:00 em São Paulo é 12:00 UTC. Lendo em UTC, "12:00" ainda cairia dentro de 08–18 por
  // acidente — por isso o caso decisivo é 07:00 BRT (10:00 UTC): fora da janela em São Paulo.
  assertEquals(
    deveResponderAutomaticamente(CONFIG_POR_DIA, {
      agora: emSaoPaulo("2026-11-30T07:00:00"),
      minutosSemRespostaHumana: 1,
      handoffAtivo: false,
    }),
    true,
  );
});

// ── AC-2: quando acordar a conversa ───────────────────────────────────────────────────────────

Deno.test("AC-2: dentro da janela com humano recente, devolve quanto falta pra assumir", () => {
  assertEquals(
    minutosAteAssumirPorInatividade(CONFIG_PADRAO, {
      agora: horario(14),
      minutosSemRespostaHumana: 5,
      handoffAtivo: false,
    }),
    25,
  );
});

Deno.test("AC-2: já passou de X — nada a esperar (responde agora)", () => {
  assertEquals(
    minutosAteAssumirPorInatividade(CONFIG_PADRAO, {
      agora: horario(14),
      minutosSemRespostaHumana: 45,
      handoffAtivo: false,
    }),
    null,
  );
});

Deno.test("AC-3: handoff ativo não agenda nada — não existe 'volta daqui a pouco'", () => {
  assertEquals(
    minutosAteAssumirPorInatividade(CONFIG_PADRAO, {
      agora: horario(14),
      minutosSemRespostaHumana: 5,
      handoffAtivo: true,
    }),
    null,
  );
});

Deno.test("fora da janela não agenda — o Zé já responde agora", () => {
  assertEquals(
    minutosAteAssumirPorInatividade(CONFIG_PADRAO, {
      agora: horario(22),
      minutosSemRespostaHumana: 5,
      handoffAtivo: false,
    }),
    null,
  );
});

// ── AC-6: o que falta para ativar ─────────────────────────────────────────────────────────────

Deno.test("faltaParaAtivar — config completa não falta nada", () => {
  assertEquals(faltaParaAtivarTriggerAutomatico(CONFIG_POR_DIA), []);
});

Deno.test("faltaParaAtivar — sem janela nenhuma aponta o horário, não um 'não pode'", () => {
  const falta = faltaParaAtivarTriggerAutomatico({
    ...CONFIG_PADRAO,
    dias: [],
    janelaInicio: null,
    janelaFim: null,
  });
  assertEquals(falta.length, 1);
  assertEquals(falta[0].includes("Horário"), true);
});

Deno.test("faltaParaAtivar — X zerado é apontado junto com o resto", () => {
  const falta = faltaParaAtivarTriggerAutomatico({
    ...CONFIG_PADRAO,
    dias: [],
    janelaInicio: null,
    janelaFim: null,
    minMinutosSemResposta: 0,
  });
  assertEquals(falta.length, 2);
});
