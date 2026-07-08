import { describe, expect, it, vi } from "vitest";
import { criarFluxo } from "./criar-fluxo";
import { desativarFluxo } from "./desativar-fluxo";
import type { FluxoGateway } from "./fluxo-gateway";
import { criarFluxoDeRecipe } from "./fluxos-avancados";
import { listarFluxos } from "./listar-fluxos";
import { salvarPassosFluxo } from "./salvar-passos-fluxo";

function fakeGateway(overrides: Partial<FluxoGateway> = {}): FluxoGateway {
  return {
    listarFluxos: vi.fn().mockResolvedValue([]),
    criarFluxo: vi.fn().mockResolvedValue({
      id: "fluxo-1",
      personaId: "persona-1",
      nome: "Qualificação",
      passos: [],
      ativo: true,
    }),
    salvarPassos: vi.fn().mockResolvedValue({
      id: "fluxo-1",
      personaId: "persona-1",
      nome: "Qualificação",
      passos: [],
      ativo: true,
    }),
    desativarFluxo: vi.fn().mockResolvedValue(undefined),
    listarRecipes: vi.fn().mockResolvedValue([]),
    listarLogs: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("listarFluxos", () => {
  it("delega ao gateway", async () => {
    const gateway = fakeGateway();
    await listarFluxos(gateway);
    expect(gateway.listarFluxos).toHaveBeenCalled();
  });
});

describe("criarFluxo", () => {
  it("valida e delega com nome normalizado", async () => {
    const gateway = fakeGateway();
    await criarFluxo(gateway, {
      nome: "  Qualificação  ",
      personaId: "persona-1",
      userId: "user-1",
    });
    expect(gateway.criarFluxo).toHaveBeenCalledWith({
      nome: "Qualificação",
      personaId: "persona-1",
      userId: "user-1",
    });
  });
});

describe("criarFluxoDeRecipe", () => {
  it("copia a definição para o novo fluxo", async () => {
    const gateway = fakeGateway({
      listarRecipes: vi.fn().mockResolvedValue([
        {
          id: "recipe-1",
          nome: "Qualificação",
          descricao: "",
          definicao: [
            {
              id: "original",
              campo: "nome",
              pergunta: "Seu nome?",
              obrigatorio: true,
              ordem: 0,
              x: 0,
              y: 0,
            },
          ],
        },
      ]),
    });
    await criarFluxoDeRecipe(gateway, {
      recipeId: "recipe-1",
      nome: "Meu fluxo",
      personaId: "persona-1",
      userId: "user-1",
    });
    expect(gateway.criarFluxo).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "Meu fluxo",
        definicao: [expect.objectContaining({ campo: "nome" })],
      }),
    );
  });
});

describe("salvarPassosFluxo", () => {
  it("exige fluxoId e ordena os passos antes de delegar", async () => {
    const gateway = fakeGateway();
    const passos = [
      {
        id: "p2",
        campo: "urgencia",
        pergunta: "Urgente?",
        obrigatorio: true,
        ordem: 1,
        x: 100,
        y: 150,
      },
      {
        id: "p1",
        campo: "orcamento",
        pergunta: "Orçamento?",
        obrigatorio: true,
        ordem: 0,
        x: 100,
        y: 0,
      },
    ];
    await salvarPassosFluxo(gateway, { fluxoId: "fluxo-1", passos, userId: "user-1" });
    expect(gateway.salvarPassos).toHaveBeenCalledWith({
      fluxoId: "fluxo-1",
      passos: [passos[1], passos[0]],
      userId: "user-1",
    });
  });

  it("lança sem chamar o gateway quando fluxoId é ausente", () => {
    const gateway = fakeGateway();
    expect(() => salvarPassosFluxo(gateway, { fluxoId: "", passos: [], userId: "user-1" })).toThrow(
      "Fluxo é obrigatório.",
    );
    expect(gateway.salvarPassos).not.toHaveBeenCalled();
  });
});

describe("desativarFluxo", () => {
  it("exige id antes de delegar", () => {
    const gateway = fakeGateway();
    expect(() => desativarFluxo(gateway, { id: "", userId: "user-1" })).toThrow(
      "Fluxo é obrigatório.",
    );
  });
});
