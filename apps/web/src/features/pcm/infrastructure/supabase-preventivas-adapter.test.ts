import { describe, expect, it, vi } from "vitest";

const consultas: Array<{
  tabela: string;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
}> = [];
let respostas: Record<string, unknown[]> = {};

function consulta(tabela: string) {
  const cadeia = {
    select: vi.fn(() => cadeia),
    eq: vi.fn(() => cadeia),
    in: vi.fn(() => cadeia),
    order: vi.fn(() =>
      tabela === "avaliacoes_preventivas"
        ? cadeia
        : Promise.resolve({ data: respostas[tabela] ?? [], error: null }),
    ),
    limit: vi.fn(() => Promise.resolve({ data: respostas[tabela] ?? [], error: null })),
  };
  consultas.push({ tabela, eq: cadeia.eq, in: cadeia.in });
  return cadeia;
}

vi.mock("../../../lib/supabase-client", () => ({
  supabase: {
    schema: vi.fn(() => ({ from: (tabela: string) => consulta(tabela) })),
  },
}));

import { listarPreventivas } from "./supabase-preventivas-adapter";

describe("listarPreventivas — E01-S53 AC-8", () => {
  it("consulta somente a cadeia de IDs do cliente aberto", async () => {
    respostas = {
      planos_preventivos: [{ id: "plano-a", cliente_id: "cliente-a" }],
      ocorrencias_preventivas: [{ id: "ocorrencia-a", plano_id: "plano-a" }],
      avaliacoes_preventivas: [{ id: "avaliacao-a", ocorrencia_id: "ocorrencia-a" }],
      ordens_servico: [{ ocorrencia_preventiva_id: "ocorrencia-a", status: "finalizado" }],
    };
    consultas.length = 0;

    const resultado = await listarPreventivas({ clienteId: "cliente-a" });

    expect(resultado.planos).toEqual([{ id: "plano-a", cliente_id: "cliente-a" }]);
    expect(resultado.ocorrencias).toEqual([
      { id: "ocorrencia-a", plano_id: "plano-a", os_status: "finalizado" },
    ]);
    expect(resultado.avaliacoes).toEqual([{ id: "avaliacao-a", ocorrencia_id: "ocorrencia-a" }]);
    expect(consultas.find((item) => item.tabela === "planos_preventivos")?.eq).toHaveBeenCalledWith(
      "cliente_id",
      "cliente-a",
    );
    expect(
      consultas.find((item) => item.tabela === "ocorrencias_preventivas")?.in,
    ).toHaveBeenCalledWith("plano_id", ["plano-a"]);
    expect(
      consultas.find((item) => item.tabela === "avaliacoes_preventivas")?.in,
    ).toHaveBeenCalledWith("ocorrencia_id", ["ocorrencia-a"]);
    expect(consultas.find((item) => item.tabela === "ordens_servico")?.in).toHaveBeenCalledWith(
      "ocorrencia_preventiva_id",
      ["ocorrencia-a"],
    );
  });

  it("não busca filhas quando o cliente não tem planos", async () => {
    respostas = { planos_preventivos: [] };
    consultas.length = 0;

    await expect(listarPreventivas({ clienteId: "cliente-a" })).resolves.toEqual({
      planos: [],
      ocorrencias: [],
      avaliacoes: [],
    });
    expect(consultas.map((item) => item.tabela)).toEqual(["planos_preventivos"]);
  });
});
