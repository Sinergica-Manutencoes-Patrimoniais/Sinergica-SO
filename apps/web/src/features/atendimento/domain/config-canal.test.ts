import { describe, expect, it } from "vitest";
import { validarConfigCanal } from "./config-canal";

describe("validarConfigCanal", () => {
  it("normaliza jids em branco para null e mantém os demais campos", () => {
    expect(
      validarConfigCanal({ clientId: "cli-1", modo: "monitor", groupJid: "  ", botJid: "  " }),
    ).toEqual({ clientId: "cli-1", modo: "monitor", groupJid: null, botJid: null });
  });

  it("aceita groupJid/botJid preenchidos com espaços removidos", () => {
    expect(
      validarConfigCanal({
        clientId: "cli-1",
        modo: "active",
        groupJid: " 123@g.us ",
        botJid: " 456 ",
      }),
    ).toEqual({ clientId: "cli-1", modo: "active", groupJid: "123@g.us", botJid: "456" });
  });

  it("rejeita clientId vazio", () => {
    expect(() =>
      validarConfigCanal({ clientId: "", modo: "off", groupJid: "", botJid: "" }),
    ).toThrow("Cliente é obrigatório.");
  });
});
