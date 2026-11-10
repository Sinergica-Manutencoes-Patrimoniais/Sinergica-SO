import { expect, it, vi } from "vitest";
const banco = vi.hoisted(() => ({
  linha: null as Record<string, unknown> | null,
  filtros: [] as [string, unknown][],
}));
vi.mock("../../../lib/supabase-client", () => {
  const consulta = {
    select: () => consulta,
    eq: (campo: string, valor: unknown) => {
      banco.filtros.push([campo, valor]);
      return consulta;
    },
    maybeSingle: async () => ({ data: banco.linha, error: null }),
  };
  return { supabase: { schema: () => ({ from: () => consulta }) } };
});
import { obterResumoOsDoCliente } from "./supabase-operacao-adapter";

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
