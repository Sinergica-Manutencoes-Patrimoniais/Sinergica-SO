import { describe, expect, it, vi } from "vitest";
import type { MarcacaoCliente } from "../domain/marcacoes-cliente";
import {
  criarMarcacao,
  definirMarcacaoCliente,
  editarMarcacao,
  excluirMarcacao,
  listarMarcacoes,
} from "./marcacoes-cliente";
import type { MarcacoesClienteGateway } from "./marcacoes-cliente-gateway";

const MARCACAO: MarcacaoCliente = { id: "m1", nome: "Lead", cor: "#2563EB", ativo: true };

function gatewayFake(): MarcacoesClienteGateway {
  return {
    listar: vi.fn(async () => [MARCACAO]),
    criar: vi.fn(async (input) => ({ id: "m2", ativo: true, ...input })),
    editar: vi.fn(async (input) => ({ ...MARCACAO, ...input })),
    excluir: vi.fn(async () => undefined),
    definirMarcacaoCliente: vi.fn(async () => undefined),
  };
}

describe("marcacoes-cliente (use case)", () => {
  it("listarMarcacoes repassa ao gateway", async () => {
    const gateway = gatewayFake();
    await listarMarcacoes(gateway);
    expect(gateway.listar).toHaveBeenCalled();
  });

  it("AC-1: criarMarcacao normaliza o nome antes de persistir", async () => {
    const gateway = gatewayFake();
    await criarMarcacao(gateway, { nome: "  Lead  ", cor: "#2563EB", userId: "user-1" });
    expect(gateway.criar).toHaveBeenCalledWith({ nome: "Lead", cor: "#2563EB", userId: "user-1" });
  });

  it("criarMarcacao rejeita cor inválida antes do round-trip", async () => {
    const gateway = gatewayFake();
    await expect(
      criarMarcacao(gateway, { nome: "Lead", cor: "azul", userId: "user-1" }),
    ).rejects.toThrow(/hex/);
    expect(gateway.criar).not.toHaveBeenCalled();
  });

  it("editarMarcacao exige id", async () => {
    const gateway = gatewayFake();
    await expect(
      editarMarcacao(gateway, { id: "", nome: "Lead", cor: "#2563EB", userId: "user-1" }),
    ).rejects.toThrow(/Marcação/);
    expect(gateway.editar).not.toHaveBeenCalled();
  });

  it("excluirMarcacao repassa ao gateway", async () => {
    const gateway = gatewayFake();
    await excluirMarcacao(gateway, "m1");
    expect(gateway.excluir).toHaveBeenCalledWith("m1");
  });

  it("AC-2: definirMarcacaoCliente troca a marcação vigente do cliente", async () => {
    const gateway = gatewayFake();
    await definirMarcacaoCliente(gateway, "cli-1", "m1", "user-1");
    expect(gateway.definirMarcacaoCliente).toHaveBeenCalledWith("cli-1", "m1", "user-1");
  });

  it("definirMarcacaoCliente aceita null pra remover a marcação", async () => {
    const gateway = gatewayFake();
    await definirMarcacaoCliente(gateway, "cli-1", null, "user-1");
    expect(gateway.definirMarcacaoCliente).toHaveBeenCalledWith("cli-1", null, "user-1");
  });
});
