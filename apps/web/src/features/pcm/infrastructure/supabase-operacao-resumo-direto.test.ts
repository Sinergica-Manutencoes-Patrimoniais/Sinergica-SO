import { expect, it, vi } from "vitest";
const banco = vi.hoisted(() => ({
  linha: null as Record<string, unknown> | null,
  filtros: [] as [string, unknown][],
  etapas: [] as string[],
  itens: [] as Record<string, unknown>[],
}));
vi.mock("../../../lib/supabase-client", () => {
  const consulta = {
    select: () => consulta,
    is: (campo: string, valor: unknown) => {
      banco.etapas.push(`${campo}=${valor}`);
      return consulta;
    },
    not: (campo: string) => {
      banco.etapas.push(campo);
      return consulta;
    },
    or: (filtro: string) => {
      banco.etapas.push(filtro);
      return consulta;
    },
    order: () => consulta,
    limit: () => {
      banco.etapas.push("pagina");
      if (banco.itens.length === 0) return { data: [], count: 67, error: null };
      const itens = banco.itens.filter(
        (item) =>
          banco.filtros.every(([campo, valor]) => item[campo] === valor) &&
          item.titulo === "Alvo de inspeção",
      );
      return { data: itens.slice(0, 51), count: itens.length, error: null };
    },
    eq: (campo: string, valor: unknown) => {
      banco.filtros.push([campo, valor]);
      return consulta;
    },
    maybeSingle: async () => ({ data: banco.linha, error: null }),
  };
  return { supabase: { schema: () => ({ from: () => consulta }) } };
});
import { obterResumoOsDoCliente, supabaseOperacaoAdapter } from "./supabase-operacao-adapter";

const cliente = "17900000-0000-4000-8000-000000000001";
const os = "17900000-0000-4000-8000-000000000002";
const linha = {
  item_id: os,
  item_tipo: "ordem_servico",
  ordem_servico_id: os,
  chamado_id: null,
  cliente_id: cliente,
  cliente_nome: "Cliente A",
  numero: "OS-1",
  titulo: "Manutenção",
  categoria: "corretiva",
  origem: "manual",
  status: "finalizado",
  prioridade: "normal",
  gravidade: null,
  urgencia: null,
  tendencia: null,
  dor_cliente: null,
  score_pcm: 0,
  origem_inspecao_item_id: null,
  auvo_task_id: null,
  auvo_sync_status: null,
  auvo_sync_error: null,
  created_at: "2026-10-30T00:00:00Z",
  tecnico_funcionario_id: null,
  tecnico_nome: null,
  data_agendada: null,
  check_in_at: null,
  check_out_at: null,
  tipo_os: null,
  pmoc_schedule_id: null,
  orientacao: null,
};

it("recupera OS finalizada do Cliente mesmo fora da página de operação", async () => {
  banco.linha = linha;
  banco.filtros = [];
  expect(await obterResumoOsDoCliente(cliente, os)).toMatchObject({
    id: os,
    clienteId: cliente,
    status: "finalizado",
  });
  expect(banco.filtros).toEqual(
    expect.arrayContaining([
      ["cliente_id", cliente],
      ["ordem_servico_id", os],
      ["item_tipo", "ordem_servico"],
    ]),
  );
});
it("recusa resposta de outra Conta ainda que o servidor a retorne", async () => {
  banco.linha = { ...linha, cliente_id: "17900000-0000-4000-8000-000000000099" };
  await expect(obterResumoOsDoCliente(cliente, os)).rejects.toThrow();
});

it("DEF-49: delimita o backlog e o cliente antes de paginar e contar", async () => {
  banco.etapas = [];
  banco.filtros = [];
  const pagina = await supabaseOperacaoAdapter.listarPagina({
    ordem: "gutd",
    limite: 50,
    clienteId: cliente,
    somenteBacklog: true,
    busca: "alvo",
    categoria: "corretiva",
    prioridade: "alta",
  });
  expect(banco.filtros).toContainEqual(["cliente_id", cliente]);
  expect(banco.filtros).toContainEqual(["item_tipo", "ordem_servico"]);
  expect(banco.filtros).toContainEqual(["categoria", "corretiva"]);
  expect(banco.filtros).toContainEqual(["prioridade", "alta"]);
  expect(banco.etapas).toEqual([
    "status",
    "data_agendada=null",
    "tecnico_funcionario_id=null",
    "auvo_task_id=null",
    "numero.ilike.*alvo*,titulo.ilike.*alvo*,cliente_nome.ilike.*alvo*",
    "pagina",
  ]);
  expect(pagina.total).toBe(67);
});

it("DEF-49: encontra a OS além da primeira página e distingue Clientes homônimos", async () => {
  banco.etapas = [];
  banco.filtros = [];
  const outraConta = "17900000-0000-4000-8000-000000000099";
  banco.itens = [
    ...Array.from({ length: 50 }, (_, indice) => ({
      ...linha,
      item_id: `fora-${indice}`,
      titulo: "Rotina",
      cliente_id: cliente,
    })),
    {
      ...linha,
      item_id: "alvo",
      titulo: "Alvo de inspeção",
      cliente_id: cliente,
      prioridade: "alta",
    },
    {
      ...linha,
      item_id: "vizinho",
      titulo: "Alvo de inspeção",
      cliente_id: outraConta,
      prioridade: "alta",
    },
  ];
  try {
    const resultado = await supabaseOperacaoAdapter.listarPagina({
      ordem: "gutd",
      limite: 50,
      somenteBacklog: true,
      clienteId: cliente,
      busca: "alvo",
      categoria: "corretiva",
      prioridade: "alta",
    });
    expect(resultado.total).toBe(1);
    expect(resultado.itens.map((ordem) => ordem.id)).toEqual(["alvo"]);
  } finally {
    banco.itens = [];
  }
});

it("DEF-21: exclui a triagem de inspeção ainda no feed operacional", async () => {
  banco.etapas = [];
  await supabaseOperacaoAdapter.listarPagina({
    ordem: "recentes",
    limite: 50,
    ocultarTriagemInspecao: true,
  });
  expect(banco.etapas).toEqual([
    "status",
    expect.stringContaining("origem_inspecao_item_id.is.null,chamado_id.not.is.null"),
    "pagina",
  ]);
});
