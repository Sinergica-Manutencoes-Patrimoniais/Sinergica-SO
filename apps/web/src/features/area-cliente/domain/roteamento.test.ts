import { describe, expect, it } from "vitest";
import { deveUsarPortal } from "./roteamento";

describe("roteamento por papel", () => {
  it("manda cliente-sindico para PortalShell", () =>
    expect(deveUsarPortal("cliente-sindico")).toBe(true));
  it.each(["superadmin", "supervisor", "colaborador"] as const)(
    "mantém %s no SO interno",
    (papel) => {
      expect(deveUsarPortal(papel)).toBe(false);
    },
  );
});
