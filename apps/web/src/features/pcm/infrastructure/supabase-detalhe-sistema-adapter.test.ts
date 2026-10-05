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
    maybeSingle: vi.fn(() => Promise.resolve({ data: resposta.data[0] ?? null, error: null })),
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

import { supabaseDetalheSistemaAdapter } from "./supabase-detalhe-sistema-adapter";

describe("supabaseDetalheSistemaAdapter — E01-S162 AC-5/AC-7", () => {
  it("limita preventivas pelo cliente e não consulta ocorrências sem plano", async () => {
    respostas = {
      sistemas: [{ data: [{ nome: "Sistema A" }], error: null }],
      sistema_itens: [{ data: [], error: null }],
      planos_preventivos: [{ data: [], error: null }],
    };
    consultas.length = 0;

    await expect(
      supabaseDetalheSistemaAdapter.listarPreventivas("sistema-a", "cliente-a"),
    ).resolves.toEqual([]);

    const planos = consultas.find((item) => item.tabela === "planos_preventivos");
    expect(planos?.eq).toHaveBeenCalledWith("cliente_id", "cliente-a");
    expect(planos?.eq).toHaveBeenCalledWith("sistema_id", "sistema-a");
    expect(consultas.map((item) => item.tabela)).not.toContain("ocorrencias_preventivas");
  });
});
