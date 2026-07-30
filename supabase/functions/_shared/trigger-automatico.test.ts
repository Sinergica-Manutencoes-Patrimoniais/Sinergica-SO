import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { deveResponderAutomaticamente } from "./trigger-automatico.ts";
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
