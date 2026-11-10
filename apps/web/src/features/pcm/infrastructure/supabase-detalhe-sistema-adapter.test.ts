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
    range: vi.fn((inicio: number, fim: number) => Promise.resolve({
      data: resposta.data.slice(inicio, fim + 1), count: resposta.data.length, error: null,
    })),
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
  it("não limita o detalhe aos primeiros 500 Planos", async () => {
    const planos = Array.from({ length: 501 }, (_, i) => ({
      id: `plano-${String(i).padStart(4, "0")}`, nome: `Plano ${i}`, estado: "ativo",
      sistema_id: "sistema-a", equipamento_id: null, intervalo_unidade: "meses", intervalo_n: 1,
    }));
    respostas = {
      sistemas: [{ data: [{ nome: "Sistema A" }], error: null }],
      sistema_itens: [{ data: [], error: null }],
      planos_preventivos: [{ data: planos, error: null }, { data: planos, error: null }],
      ocorrencias_preventivas: Array.from({ length: 6 }, () => ({ data: [], error: null })),
    };
    consultas.length = 0;
    const resultado = await supabaseDetalheSistemaAdapter.listarPreventivas("sistema-a", "cliente-a");
    expect(resultado).toHaveLength(501);
    for (const lote of consultas.filter((item) => item.tabela === "ocorrencias_preventivas"))
      expect(lote.in.mock.calls[0]?.[1].length).toBeLessThanOrEqual(100);
  });
  it("preserva todas as OS da preventiva no contexto do Cliente", async () => {
    respostas = {
      sistemas: [{ data: [{ nome: "Sistema A" }], error: null }],
      sistema_itens: [{ data: [], error: null }],
      planos_preventivos: [{ data: [{ id: "plano-a", nome: "Plano A", estado: "ativo", sistema_id: "sistema-a", equipamento_id: null, intervalo_unidade: "meses", intervalo_n: 1 }], error: null }],
      ocorrencias_preventivas: [{ data: [{ id: "ocorrencia-a", plano_id: "plano-a", vencimento: "2026-10-01", visita_em: null, envio_estado: "disponivel", auvo_task_id: 123, tecnico_funcionario_id: null, resultado_estado: "pendente" }], error: null }],
      ordens_servico: [{ data: [
        { id: "os-a", ocorrencia_preventiva_id: "ocorrencia-a", numero: "OS-A", status: "finalizado", check_out_at: "2026-10-02T10:00:00Z" },
        { id: "os-b", ocorrencia_preventiva_id: "ocorrencia-a", numero: "OS-B", status: "planejamento", check_out_at: null },
      ], error: null }],
    };
    consultas.length = 0;
    const preventivas = await supabaseDetalheSistemaAdapter.listarPreventivas("sistema-a", "cliente-a");
    expect(preventivas[0]?.ocorrencias[0]).toMatchObject({
      osId: null, osNumero: null, concluidaEm: null,
      ordensVinculadas: [{ id: "os-a", numero: "OS-A", status: "finalizado" }, { id: "os-b", numero: "OS-B", status: "planejamento" }],
    });
    expect(consultas.find((item) => item.tabela === "ordens_servico")?.eq).toHaveBeenCalledWith("client_id", "cliente-a");
  });
  it("consulta somente origem legada no histórico de Plano preventivo legado", async () => {
    respostas = {
      sistemas: [{ data: [{ nome: "Sistema A" }], error: null }],
      sistema_itens: [{ data: [], error: null }],
      planos_preventivos: [{ data: [{ id: "plano-a", nome: "Plano A", estado: "ativo", sistema_id: "sistema-a", equipamento_id: null, intervalo_unidade: "meses", intervalo_n: 1 }], error: null }],
      ocorrencias_preventivas: [{ data: [], error: null }],
    };
    consultas.length = 0;
    await supabaseDetalheSistemaAdapter.listarPreventivas("sistema-a", "cliente-a");
    expect(consultas.find((item) => item.tabela === "ocorrencias_preventivas")?.eq).toHaveBeenCalledWith("origem", "legado");
  });
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
