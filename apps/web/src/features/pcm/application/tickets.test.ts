import { describe, expect, it, vi } from "vitest";
import { arquivarTicket, criarTicket, mudarStatusTicket } from "./tickets";
import type { TicketsGateway } from "./tickets-gateway";

function fakeGateway(overrides: Partial<TicketsGateway> = {}): TicketsGateway {
  return {
    listar: vi.fn().mockResolvedValue([]),
    listarClientes: vi.fn().mockResolvedValue([{ id: "cli-1", nome: "Cliente A", auvoId: 501 }]),
    listarEquipes: vi.fn().mockResolvedValue([]),
    listarReferencia: vi.fn().mockResolvedValue([]),
    criar: vi.fn().mockResolvedValue({ id: "tkt-1" }),
    mudarStatus: vi.fn().mockResolvedValue({ id: "tkt-1" }),
    arquivar: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("criarTicket", () => {
  it("valida contra os clientes sincronizados antes de delegar ao gateway", async () => {
    const gateway = fakeGateway();
    await criarTicket(gateway, {
      titulo: "Vazamento",
      descricao: null,
      clienteId: "cli-1",
      equipeId: null,
      prioridade: null,
      requestTypeId: null,
      statusId: null,
      userId: "user-1",
    });
    expect(gateway.criar).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: "Vazamento", clienteId: "cli-1", userId: "user-1" }),
    );
  });

  it("propaga o erro do domínio quando o cliente não está sincronizado com o Auvo", async () => {
    const gateway = fakeGateway({
      listarClientes: vi.fn().mockResolvedValue([{ id: "cli-1", nome: "Cliente A", auvoId: null }]),
    });
    await expect(
      criarTicket(gateway, {
        titulo: "Vazamento",
        descricao: null,
        clienteId: "cli-1",
        equipeId: null,
        prioridade: null,
        requestTypeId: null,
        statusId: null,
        userId: "user-1",
      }),
    ).rejects.toThrow(/Sincronize o cliente/);
    expect(gateway.criar).not.toHaveBeenCalled();
  });
});

describe("mudarStatusTicket", () => {
  it("exige id e statusId antes de delegar ao gateway", async () => {
    const gateway = fakeGateway();
    await mudarStatusTicket(gateway, { id: "tkt-1", statusId: 2, userId: "user-1" });
    expect(gateway.mudarStatus).toHaveBeenCalledWith({
      id: "tkt-1",
      statusId: 2,
      userId: "user-1",
    });
  });

  it("lança sem chamar o gateway quando statusId é ausente", () => {
    const gateway = fakeGateway();
    expect(() =>
      mudarStatusTicket(gateway, {
        id: "tkt-1",
        statusId: null as unknown as number,
        userId: "user-1",
      }),
    ).toThrow(/Status é obrigatório/);
    expect(gateway.mudarStatus).not.toHaveBeenCalled();
  });
});

describe("arquivarTicket", () => {
  it("lança sem chamar o gateway quando id é ausente", () => {
    const gateway = fakeGateway();
    expect(() => arquivarTicket(gateway, { id: "", userId: "user-1" })).toThrow(
      /Ticket é obrigatório/,
    );
    expect(gateway.arquivar).not.toHaveBeenCalled();
  });

  it("delega ao gateway quando id é válido", async () => {
    const gateway = fakeGateway();
    await arquivarTicket(gateway, { id: "tkt-1", userId: "user-1" });
    expect(gateway.arquivar).toHaveBeenCalledWith({ id: "tkt-1", userId: "user-1" });
  });
});
