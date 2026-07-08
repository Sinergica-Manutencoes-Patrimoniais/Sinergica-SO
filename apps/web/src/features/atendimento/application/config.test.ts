import { describe, expect, it, vi } from "vitest";
import { buscarConfigCanal } from "./buscar-config-canal";
import type { ConfigGateway } from "./config-gateway";
import { criarTag } from "./criar-tag";
import { desativarTag } from "./desativar-tag";
import { editarTag } from "./editar-tag";
import { salvarConfigCanal } from "./salvar-config-canal";

function fakeGateway(overrides: Partial<ConfigGateway> = {}): ConfigGateway {
  return {
    listarClientes: vi.fn().mockResolvedValue([]),
    listarTags: vi.fn().mockResolvedValue([]),
    criarTag: vi.fn().mockResolvedValue({ id: "tag-1", nome: "Urgente", ativo: true }),
    editarTag: vi.fn().mockResolvedValue({ id: "tag-1", nome: "Urgente", ativo: true }),
    desativarTag: vi.fn().mockResolvedValue(undefined),
    buscarConfigCanal: vi.fn().mockResolvedValue(null),
    salvarConfigCanal: vi.fn().mockResolvedValue({
      id: "cfg-1",
      clientId: "cli-1",
      modo: "monitor",
      groupJid: null,
      botJid: null,
    }),
    ...overrides,
  };
}

describe("criarTag", () => {
  it("valida e delega ao gateway com o nome normalizado", async () => {
    const gateway = fakeGateway();
    await criarTag(gateway, { nome: "  Urgente  ", userId: "user-1" });
    expect(gateway.criarTag).toHaveBeenCalledWith({ nome: "Urgente", userId: "user-1" });
  });

  it("lança sem chamar o gateway quando o nome é vazio", () => {
    const gateway = fakeGateway();
    expect(() => criarTag(gateway, { nome: "  ", userId: "user-1" })).toThrow(
      "Nome da tag é obrigatório.",
    );
    expect(gateway.criarTag).not.toHaveBeenCalled();
  });
});

describe("editarTag / desativarTag", () => {
  it("exigem id antes de delegar", () => {
    const gateway = fakeGateway();
    expect(() => editarTag(gateway, { id: "", nome: "Urgente", userId: "user-1" })).toThrow(
      "Tag é obrigatória.",
    );
    expect(() => desativarTag(gateway, { id: "", userId: "user-1" })).toThrow("Tag é obrigatória.");
  });

  it("delegam ao gateway quando id é válido", async () => {
    const gateway = fakeGateway();
    await editarTag(gateway, { id: "tag-1", nome: "Urgente", userId: "user-1" });
    expect(gateway.editarTag).toHaveBeenCalledWith({
      id: "tag-1",
      nome: "Urgente",
      userId: "user-1",
    });

    await desativarTag(gateway, { id: "tag-1", userId: "user-1" });
    expect(gateway.desativarTag).toHaveBeenCalledWith({ id: "tag-1", userId: "user-1" });
  });
});

describe("buscarConfigCanal / salvarConfigCanal", () => {
  it("exige clientId antes de buscar", () => {
    const gateway = fakeGateway();
    expect(() => buscarConfigCanal(gateway, "")).toThrow("Cliente é obrigatório.");
  });

  it("valida e delega salvarConfigCanal com jids normalizados", async () => {
    const gateway = fakeGateway();
    await salvarConfigCanal(gateway, {
      clientId: "cli-1",
      modo: "active",
      groupJid: " 123@g.us ",
      botJid: "",
      userId: "user-1",
    });
    expect(gateway.salvarConfigCanal).toHaveBeenCalledWith({
      clientId: "cli-1",
      modo: "active",
      groupJid: "123@g.us",
      botJid: null,
      userId: "user-1",
    });
  });
});
