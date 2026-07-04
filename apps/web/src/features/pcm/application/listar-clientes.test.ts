import { describe, expect, it, vi } from "vitest";
import type { Cliente360Gateway, ClienteResumo } from "./cliente-360-gateway";
import { listarClientes } from "./listar-clientes";

// specs/E01-S12-visao-360-cliente — Task 18 (lista mínima de clientes para navegação).

const CLIENTES: ClienteResumo[] = [
  { id: "c1", nome: "Cond. Primavera", cnpj: "12.345.678/0001-99", ativo: true },
  { id: "c2", nome: "Res. Vila Verde", cnpj: null, ativo: false },
];

function gatewayMock(overrides: Partial<Cliente360Gateway> = {}): Cliente360Gateway {
  return {
    listarClientes: vi.fn(async () => CLIENTES),
    buscarCliente: vi.fn(async () => null),
    listarBacklogCliente: vi.fn(async () => []),
    listarHistoricoCliente: vi.fn(async () => []),
    listarEquipamentosCliente: vi.fn(async () => "indisponivel" as const),
    ...overrides,
  };
}

describe("listarClientes", () => {
  it("repassa a lista de clientes do gateway (ordenação é responsabilidade do servidor)", async () => {
    const gateway = gatewayMock();
    expect(await listarClientes(gateway)).toEqual(CLIENTES);
  });

  it("cliente sem CNPJ (cnpj null) é repassado sem quebrar", async () => {
    const gateway = gatewayMock();
    const lista = await listarClientes(gateway);
    expect(lista[1]?.cnpj).toBeNull();
  });

  it("propaga erro de leitura do gateway (não engole — a lista deve entrar em erro)", async () => {
    const gateway = gatewayMock({
      listarClientes: vi.fn(async () => {
        throw new Error("falha de leitura de pcm.clientes");
      }),
    });
    await expect(listarClientes(gateway)).rejects.toThrow(/pcm\.clientes/);
  });
});
