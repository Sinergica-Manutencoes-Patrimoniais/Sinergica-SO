import { describe, expect, it } from "vitest";
import { statusConformidade } from "./conformidade";

describe("statusConformidade", () => {
  const hoje = new Date(2026, 6, 21);
  it("marca vencido", () => expect(statusConformidade("2026-07-20", hoje)).toBe("vencido"));
  it("marca vencendo em até 30 dias", () =>
    expect(statusConformidade("2026-08-20", hoje)).toBe("vencendo"));
  it("marca vigente acima de 30 dias", () =>
    expect(statusConformidade("2026-08-21", hoje)).toBe("vigente"));
});
