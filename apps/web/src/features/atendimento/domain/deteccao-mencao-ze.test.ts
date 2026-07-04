import { describe, expect, it } from "vitest";
import { deveAcionarZe, mencionaZe } from "./deteccao-mencao-ze";

describe("detecção determinística de menção ao Zé", () => {
  it("AC-3: detecta Zé com e sem acento", () => {
    expect(mencionaZe("Zé, abriu vazamento")).toBe(true);
    expect(mencionaZe("ze preciso de ajuda")).toBe(true);
  });

  it("AC-3: detecta bot_jid", () => {
    expect(mencionaZe("pode ver isso @5511999999999", "5511999999999")).toBe(true);
  });

  it("não detecta substrings como zelador", () => {
    expect(mencionaZe("o zelador viu o vazamento")).toBe(false);
  });

  it("AC-4: menção aciona nos modos monitor e active, mas off sempre pula", () => {
    expect(deveAcionarZe({ content: "Zé, vazamento", modo: "monitor" })).toBe(true);
    expect(deveAcionarZe({ content: "Zé, vazamento", modo: "active" })).toBe(true);
    expect(deveAcionarZe({ content: "Zé, vazamento", modo: "off" })).toBe(false);
  });

  it("AC-4: sem menção só active aciona", () => {
    expect(deveAcionarZe({ content: "vazamento no térreo", modo: "active" })).toBe(true);
    expect(deveAcionarZe({ content: "vazamento no térreo", modo: "monitor" })).toBe(false);
    expect(deveAcionarZe({ content: "vazamento no térreo", modo: "off" })).toBe(false);
  });
});
