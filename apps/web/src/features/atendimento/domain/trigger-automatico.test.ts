import { describe, expect, it } from "vitest";
import { faltaParaAtivarTrigger, validarTriggerAutomatico } from "./trigger-automatico";

const BASE = {
  ativo: true,
  minMinutosSemResposta: 30,
  janelas: [
    { dia: 1, inicio: "08:00", fim: "18:00" },
    { dia: 6, inicio: "08:00", fim: "12:00" },
    { dia: 0, inicio: "", fim: "" }, // domingo sem atendimento humano
  ],
};

describe("validarTriggerAutomatico", () => {
  it("AC-6: mantém as janelas preenchidas e descarta o dia em branco", () => {
    const validado = validarTriggerAutomatico(BASE);
    expect(validado.janelas.map((j) => j.dia)).toEqual([1, 6]);
  });

  it("AC-6: início sem fim é erro — meia janela não é configuração", () => {
    expect(() =>
      validarTriggerAutomatico({ ...BASE, janelas: [{ dia: 2, inicio: "08:00", fim: "" }] }),
    ).toThrow(/início e fim juntos/i);
  });

  it("AC-6: fim antes do início é erro, com o nome do dia na mensagem", () => {
    expect(() =>
      validarTriggerAutomatico({ ...BASE, janelas: [{ dia: 3, inicio: "18:00", fim: "08:00" }] }),
    ).toThrow(/Quarta/);
  });

  it("recusa X zerado ou negativo", () => {
    expect(() => validarTriggerAutomatico({ ...BASE, minMinutosSemResposta: 0 })).toThrow(
      /maior que zero/i,
    );
    expect(() => validarTriggerAutomatico({ ...BASE, minMinutosSemResposta: -5 })).toThrow();
  });

  it("recusa X acima de 24 horas", () => {
    expect(() => validarTriggerAutomatico({ ...BASE, minMinutosSemResposta: 1441 })).toThrow(
      /24 horas/,
    );
  });

  it("AC-1: zero janelas é configuração válida (Zé assume o tempo todo)", () => {
    const validado = validarTriggerAutomatico({ ...BASE, janelas: [] });
    expect(validado.janelas).toEqual([]);
  });
});

describe("faltaParaAtivarTrigger", () => {
  it("config completa e ligada não avisa nada", () => {
    expect(faltaParaAtivarTrigger(BASE)).toEqual([]);
  });

  it("avisa que sem horário nenhum o Zé responde o tempo todo", () => {
    const avisos = faltaParaAtivarTrigger({ ...BASE, janelas: [] });
    expect(avisos.join(" ")).toMatch(/tempo todo/);
  });

  it("avisa que desligado nada tem efeito", () => {
    const avisos = faltaParaAtivarTrigger({ ...BASE, ativo: false });
    expect(avisos.join(" ")).toMatch(/desligado/);
  });
});
