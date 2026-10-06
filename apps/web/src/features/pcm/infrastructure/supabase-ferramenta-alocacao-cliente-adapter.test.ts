import { describe, expect, it, vi } from "vitest";

const consultas: Array<{
  tabela: string;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
}> = [];
let respostas: Record<string, Array<{ data: unknown[]; error: null }>> = {};

function consulta(tabela: string) {
  const resposta = respostas[tabela]?.shift() ?? { data: [], error: null };
  const cadeia = {
    select: vi.fn(() => cadeia),
    eq: vi.fn(() => cadeia),
    in: vi.fn(() => cadeia),
    is: vi.fn(() => cadeia),
    order: vi.fn(() => cadeia),
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders são thenables.
    then: (resolver: (valor: typeof resposta) => unknown, rejeitar?: (erro: unknown) => unknown) =>
      Promise.resolve(resposta).then(resolver, rejeitar),
  };
  consultas.push({ tabela, eq: cadeia.eq, in: cadeia.in });
  return cadeia;
}

vi.mock("../../../lib/supabase-client", () => ({
  supabase: { schema: vi.fn(() => ({ from: (tabela: string) => consulta(tabela) })) },
}));

import { supabaseFerramentaAlocacaoClienteAdapter } from "./supabase-ferramenta-alocacao-cliente-adapter";

describe("supabaseFerramentaAlocacaoClienteAdapter — filtros do Cliente 360", () => {
  it("traz a categoria indexada da ferramenta junto da alocação do cliente", async () => {
    respostas = {
      ferramenta_alocacoes_cliente: [
        {
          data: [
            {
              id: "alocacao-1",
              ferramenta_id: "ferramenta-1",
              cliente_id: "cliente-1",
              alocada_em: "2026-10-01T10:00:00Z",
              devolvida_em: null,
            },
          ],
          error: null,
        },
      ],
      ferramentas: [
        { data: [{ id: "ferramenta-1", nome: "Furadeira", categoria_id: "cat-1" }], error: null },
      ],
      clientes: [{ data: [{ id: "cliente-1", nome: "Guainumbí" }], error: null }],
      produto_categorias: [{ data: [{ id: "cat-1", nome: "Elétrica" }], error: null }],
    };
    consultas.length = 0;

    await expect(
      supabaseFerramentaAlocacaoClienteAdapter.listarPorCliente("cliente-1"),
    ).resolves.toEqual([
      expect.objectContaining({
        ferramentaNome: "Furadeira",
        categoriaId: "cat-1",
        categoriaNome: "Elétrica",
      }),
    ]);

    expect(consultas.find((item) => item.tabela === "produto_categorias")?.in).toHaveBeenCalledWith(
      "id",
      ["cat-1"],
    );
  });
});
