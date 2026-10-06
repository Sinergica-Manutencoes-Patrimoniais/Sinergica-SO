import { describe, expect, it, vi } from "vitest";

const consultas: Array<{
  tabela: string;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
}> = [];
let respostas: Record<string, unknown[]> = {};
let planoParaAtualizacao: Record<string, unknown> | null = null;
let ocorrenciasMaterializadas = 0;
const atualizacoes: unknown[] = [];

function consulta(tabela: string) {
  let opcoesSelect: { count?: string; head?: boolean } | undefined;
  let atualizando = false;
  let filtrosDaAtualizacao = 0;
  const cadeia = {
    select: vi.fn((_colunas?: string, opcoes?: { count?: string; head?: boolean }) => {
      opcoesSelect = opcoes;
      return cadeia;
    }),
    eq: vi.fn(() => {
      if (atualizando) {
        filtrosDaAtualizacao += 1;
        return filtrosDaAtualizacao === 2 ? Promise.resolve({ error: null }) : cadeia;
      }
      if (tabela === "ocorrencias_preventivas" && opcoesSelect?.head) {
        return Promise.resolve({ count: ocorrenciasMaterializadas, error: null });
      }
      return cadeia;
    }),
    in: vi.fn(() => cadeia),
    maybeSingle: vi.fn(() => Promise.resolve({ data: planoParaAtualizacao, error: null })),
    update: vi.fn((alteracoes: unknown) => {
      atualizando = true;
      atualizacoes.push(alteracoes);
      return cadeia;
    }),
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

import { atualizarPlanoPreventivo, listarPreventivas } from "./supabase-preventivas-adapter";

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

describe("atualizarPlanoPreventivo — E01-S163 AC-13 e AC-14", () => {
  const planoBase = {
    id: "plano-a",
    cliente_id: "cliente-a",
    sistema_id: null,
    equipamento_id: "equipamento-a",
    primeira_data: "2026-10-10",
    intervalo_unidade: "meses",
    intervalo_n: 1,
  };

  it("rejeita plano de outro cliente antes de qualquer escrita", async () => {
    planoParaAtualizacao = { ...planoBase, cliente_id: "cliente-b" };
    ocorrenciasMaterializadas = 0;
    atualizacoes.length = 0;
    consultas.length = 0;

    await expect(
      atualizarPlanoPreventivo({
        planoId: "plano-a",
        clienteId: "cliente-a",
        userId: "user-1",
        alteracoes: { nome: "Plano revisado" },
      }),
    ).rejects.toThrow("não pertence ao cliente em contexto");

    expect(atualizacoes).toEqual([]);
  });

  it("bloqueia alteração estrutural quando já existem ocorrências, sem regravá-las", async () => {
    planoParaAtualizacao = planoBase;
    ocorrenciasMaterializadas = 1;
    atualizacoes.length = 0;
    consultas.length = 0;

    await expect(
      atualizarPlanoPreventivo({
        planoId: "plano-a",
        clienteId: "cliente-a",
        userId: "user-1",
        alteracoes: { intervalo_n: 2 },
      }),
    ).rejects.toThrow("não podem ser alterados após a primeira ocorrência");

    expect(atualizacoes).toEqual([]);
  });

  it("permite metadados sem reescrever ocorrências existentes", async () => {
    planoParaAtualizacao = planoBase;
    ocorrenciasMaterializadas = 1;
    atualizacoes.length = 0;
    consultas.length = 0;

    await atualizarPlanoPreventivo({
      planoId: "plano-a",
      clienteId: "cliente-a",
      userId: "user-1",
      alteracoes: { nome: "Plano revisado" },
    });

    expect(atualizacoes).toEqual([
      expect.objectContaining({ nome: "Plano revisado", updated_by: "user-1" }),
    ]);
    expect(consultas.map((item) => item.tabela)).not.toContain("ocorrencias_preventivas");
  });
});
