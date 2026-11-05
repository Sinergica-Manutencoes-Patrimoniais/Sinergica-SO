import { describe, expect, it, vi } from "vitest";

const consultas: Array<{
  tabela: string;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
}> = [];
let respostas: Record<string, unknown[]> = {};
let contagensOs: number[] | null = null;
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
    is: vi.fn(() => cadeia),
    maybeSingle: vi.fn(() => Promise.resolve({ data: planoParaAtualizacao, error: null })),
    update: vi.fn((alteracoes: unknown) => {
      atualizando = true;
      atualizacoes.push(alteracoes);
      return cadeia;
    }),
    order: vi.fn(() =>
      tabela === "avaliacoes_preventivas" || tabela === "ordens_servico" ||
      tabela === "planos_preventivos" || tabela === "ocorrencias_preventivas" ||
      tabela === "sistemas" || tabela === "equipamentos"
        ? cadeia
        : Promise.resolve({ data: respostas[tabela] ?? [], error: null }),
    ),
    range: vi.fn((inicio: number, fim: number) => Promise.resolve({
      data: (respostas[tabela] ?? []).slice(inicio, fim + 1),
      count: tabela === "ordens_servico" && contagensOs ? contagensOs.shift() : (respostas[tabela] ?? []).length,
      error: null,
    })),
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
  it("resolve nomes dos Sistemas e Componentes sem trocar seus cadastros", async () => {
    respostas = {
      planos_preventivos: [
        { id: "plano-a", cliente_id: "cliente-a", sistema_id: "sistema-a", equipamento_id: null },
        { id: "plano-b", cliente_id: "cliente-a", sistema_id: null, equipamento_id: "componente-a" },
      ],
      sistemas: [{ id: "sistema-a", nome: "Sistema A" }],
      equipamentos: [{ id: "componente-a", nome: "Componente A" }],
      ocorrencias_preventivas: [],
    };
    consultas.length = 0;
    const resultado = await listarPreventivas({ clienteId: "cliente-a" });
    expect(resultado.planos.map((p) => p.alvo_nome)).toEqual(["Sistema A", "Componente A"]);
    expect(consultas.find((item) => item.tabela === "sistemas")?.eq).toHaveBeenCalledWith("cliente_id", "cliente-a");
    expect(consultas.find((item) => item.tabela === "equipamentos")?.eq).toHaveBeenCalledWith("client_id", "cliente-a");
  });
  it("consulta somente a cadeia de IDs do cliente aberto", async () => {
    respostas = {
      planos_preventivos: [{ id: "plano-a", cliente_id: "cliente-a" }],
      ocorrencias_preventivas: [{ id: "ocorrencia-a", plano_id: "plano-a" }],
      avaliacoes_preventivas: [{ id: "avaliacao-a", ocorrencia_id: "ocorrencia-a" }],
      ordens_servico: [{ id: "os-a", numero: "OS-A", ocorrencia_preventiva_id: "ocorrencia-a", status: "finalizado" }],
    };
    consultas.length = 0;

    const resultado = await listarPreventivas({ clienteId: "cliente-a" });

    expect(resultado.planos).toEqual([{ id: "plano-a", cliente_id: "cliente-a" }]);
    expect(resultado.ocorrencias).toEqual([
      { id: "ocorrencia-a", plano_id: "plano-a", reconciliacao_legada: "normal", os_status: "finalizado", os_id: "os-a", os_numero: "OS-A", ordens_vinculadas: [{ id: "os-a", numero: "OS-A", status: "finalizado" }] },
    ]);
    expect(resultado.avaliacoes).toEqual([{ id: "avaliacao-a", ocorrencia_id: "ocorrencia-a" }]);
    expect(consultas.find((item) => item.tabela === "planos_preventivos")?.eq).toHaveBeenCalledWith(
      "cliente_id",
      "cliente-a",
    );
    expect(
      consultas.find((item) => item.tabela === "ocorrencias_preventivas")?.in,
    ).toHaveBeenCalledWith("plano_id", ["plano-a"]);
    expect(consultas.find((item) => item.tabela === "ocorrencias_preventivas")?.eq).toHaveBeenCalledWith("origem", "legado");
    expect(
      consultas.find((item) => item.tabela === "avaliacoes_preventivas")?.in,
    ).toHaveBeenCalledWith("ocorrencia_id", ["ocorrencia-a"]);
    expect(consultas.find((item) => item.tabela === "ordens_servico")?.in).toHaveBeenCalledWith(
      "ocorrencia_preventiva_id",
      ["ocorrencia-a"],
    );
    expect(consultas.find((item) => item.tabela === "ordens_servico")?.eq).toHaveBeenCalledWith("client_id", "cliente-a");
  });

  it("preserva todas as OS da ocorrência sem escolher uma como representativa", async () => {
    respostas = {
      planos_preventivos: [{ id: "plano-a", cliente_id: "cliente-a" }],
      ocorrencias_preventivas: [{ id: "ocorrencia-a", plano_id: "plano-a" }],
      avaliacoes_preventivas: [],
      ordens_servico: [
        { id: "os-a", numero: "OS-A", ocorrencia_preventiva_id: "ocorrencia-a", status: "finalizado" },
        { id: "os-b", numero: "OS-B", ocorrencia_preventiva_id: "ocorrencia-a", status: "planejamento" },
      ],
    };
    const resultado = await listarPreventivas({ clienteId: "cliente-a" });
    expect(resultado.ocorrencias[0]).toMatchObject({
      os_status: null,
      ordens_vinculadas: [
        { id: "os-a", numero: "OS-A", status: "finalizado" },
        { id: "os-b", numero: "OS-B", status: "planejamento" },
      ],
    });
    expect(resultado.ocorrencias[0]?.os_id).toBeUndefined();
    expect(resultado.ocorrencias[0]?.os_numero).toBeUndefined();
  });

  it("carrega todas as páginas de OS sem perder vínculos da mesma ocorrência", async () => {
    respostas = {
      planos_preventivos: [{ id: "plano-a", cliente_id: "cliente-a" }],
      ocorrencias_preventivas: [{ id: "ocorrencia-a", plano_id: "plano-a" }],
      avaliacoes_preventivas: [],
      ordens_servico: Array.from({ length: 501 }, (_, i) => ({
        id: `os-${String(i).padStart(4, "0")}`, numero: `OS-${i}`,
        ocorrencia_preventiva_id: "ocorrencia-a", status: "planejamento",
      })),
    };
    const resultado = await listarPreventivas({ clienteId: "cliente-a" });
    expect(resultado.ocorrencias[0]?.ordens_vinculadas).toHaveLength(501);
    expect(resultado.ocorrencias[0]?.os_id).toBeUndefined();
  });

  it("recusa a lista quando a quantidade de OS muda entre páginas", async () => {
    respostas = {
      planos_preventivos: [{ id: "plano-a", cliente_id: "cliente-a" }],
      ocorrencias_preventivas: [{ id: "ocorrencia-a", plano_id: "plano-a" }],
      avaliacoes_preventivas: [],
      ordens_servico: Array.from({ length: 501 }, (_, i) => ({
        id: `os-${String(i).padStart(4, "0")}`, numero: `OS-${i}`,
        ocorrencia_preventiva_id: "ocorrencia-a", status: "planejamento",
      })),
    };
    contagensOs = [501, 500];
    try {
      await expect(listarPreventivas({ clienteId: "cliente-a" })).rejects.toThrow("Não foi possível conferir todas as OS.");
    } finally {
      contagensOs = null;
    }
  });

  it("carrega Planos além de uma página sem buscar ocorrências fora de seus lotes", async () => {
    respostas = {
      planos_preventivos: Array.from({ length: 501 }, (_, i) => ({
        id: `plano-${String(i).padStart(4, "0")}`, cliente_id: "cliente-a", primeira_data: "2026-01-01",
      })),
      ocorrencias_preventivas: [],
    };
    consultas.length = 0;
    const resultado = await listarPreventivas({ clienteId: "cliente-a" });
    expect(resultado.planos).toHaveLength(501);
    const lotes = consultas.filter((item) => item.tabela === "ocorrencias_preventivas");
    expect(lotes).toHaveLength(6);
    for (const lote of lotes) expect(lote.in.mock.calls[0]?.[1].length).toBeLessThanOrEqual(100);
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
