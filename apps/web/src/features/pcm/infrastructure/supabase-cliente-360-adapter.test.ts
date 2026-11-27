import { expect, it, vi } from "vitest";
import { supabaseCliente360Adapter } from "./supabase-cliente-360-adapter";

const banco = vi.hoisted(() => ({
  ordens: [] as Record<string, unknown>[],
  contagens: [] as Record<string, unknown>[],
  rpcs: [] as { nome: string; params: unknown }[],
}));
vi.mock("../../../lib/supabase-client", () => ({
  supabase: {
    schema: () => ({
      rpc: (nome: string, params: unknown) => {
        banco.rpcs.push({ nome, params });
        const resposta = { data: banco.contagens, error: null };
        return { ...resposta, abortSignal: () => resposta };
      },
      from: (tabela: string) => {
        const equipamentos = [
          {
            ativo: true,
            auvo_customer_id: 12,
            auvo_equipment_id: null,
            updated_at: "2026-11-25T20:00:00Z",
          },
          {
            ativo: true,
            auvo_customer_id: 12,
            auvo_equipment_id: 321,
            updated_at: "2026-11-25T18:00:00Z",
          },
        ];
        let limiteConsulta = 500;
        let inicioConsulta = 0;
        let linhas: Record<string, unknown>[] =
          tabela === "equipamentos"
            ? equipamentos
            : tabela === "ordens_servico"
              ? banco.ordens
              : [];
        if (tabela === "clientes") linhas = [{ id: "cliente-ficticio", nome: "Cliente fictício" }];
        const consulta = {
          select: () => consulta,
          eq: (coluna: string, valor: unknown) => {
            linhas = linhas.filter((linha) => linha[coluna] === valor);
            return consulta;
          },
          is: () => consulta,
          neq: () => consulta,
          gt: (campo: string, valor: string) => {
            linhas = linhas.filter((linha) => String(linha[campo]) > valor);
            return consulta;
          },
          not: (coluna: string, operador: string, valor: unknown) => {
            if (coluna === "status" && operador === "in") {
              const historicos = String(valor).slice(1, -1).split(",");
              linhas = linhas.filter((linha) => !historicos.includes(String(linha.status)));
              return consulta;
            }
            expect([coluna, operador, valor]).toEqual(["auvo_equipment_id", "is", null]);
            linhas = linhas.filter((linha) => linha.auvo_equipment_id !== null);
            return consulta;
          },
          order: () => consulta,
          limit: (limite: number) => {
            limiteConsulta = limite;
            return consulta;
          },
          range: (inicio: number, fim: number) => {
            inicioConsulta = inicio;
            limiteConsulta = fim + 1;
            return consulta;
          },
          maybeSingle: () => ({ data: { auvo_id: 12 }, error: null }),
          get data() {
            return linhas.slice(inicioConsulta, limiteConsulta);
          },
          error: null,
        };
        return consulta;
      },
    }),
  },
}));

it("DEF-29: ignora o ativo local mais recente ao buscar a atualização Auvo", async () => {
  const eventos = await supabaseCliente360Adapter.listarEventosCliente("cliente-ficticio");
  expect(eventos).toEqual([
    expect.objectContaining({
      titulo: "Ativos Auvo atualizados",
      subtitulo: "Último equipamento no cache: #321",
      data: "2026-11-25T18:00:00Z",
    }),
  ]);
});

it("E01-S204: OS abertas da carteira vêm da contagem oficial; score segue lendo todas as páginas", async () => {
  banco.ordens = Array.from({ length: 503 }, (_, indice) => ({
    id: String(indice).padStart(4, "0"),
    client_id: indice < 500 ? "outro-cliente" : "cliente-ficticio",
    status: indice === 502 ? "finalizado" : "planejamento",
    score_pcm: indice === 501 ? 77 : 3,
    created_at: "2026-11-25T00:00:00Z",
    auvo_synced_at: null,
  }));
  // As duas OS não históricas do cliente na listagem (uma delas pré-chamado ou ponto de visita)
  // não decidem mais a contagem: vale o que o servidor classifica.
  banco.contagens = [
    {
      cliente_id: "cliente-ficticio",
      os_abertas: 1,
      backlog: 1,
      pre_chamados: 1,
      chamados_abertos: 0,
      demanda_em_aberto: 2,
    },
  ];
  banco.rpcs = [];
  expect(await supabaseCliente360Adapter.listarClientes()).toEqual([
    expect.objectContaining({ id: "cliente-ficticio", osAbertas: 1, maiorScorePcm: 77 }),
  ]);
  expect(banco.rpcs).toEqual([
    { nome: "fn_contagem_operacional_por_cliente", params: { p_cliente_id: null } },
  ]);
});

it("E01-S204: Cliente sem linha na contagem tem zero OS abertas", async () => {
  banco.ordens = [];
  banco.contagens = [];
  expect(await supabaseCliente360Adapter.listarClientes()).toEqual([
    expect.objectContaining({ id: "cliente-ficticio", osAbertas: 0 }),
  ]);
});

it("DEF-40: o detalhe traz todas as páginas elegíveis do mesmo cliente", async () => {
  banco.ordens = Array.from({ length: 503 }, (_, indice) => ({
    id: String(indice).padStart(4, "0"),
    client_id: indice === 500 ? "outro-cliente" : "cliente-ficticio",
    status: indice === 501 ? "finalizado" : "planejamento",
    score_pcm: 3,
    created_at: "2026-11-25T00:00:00Z",
  }));
  const filas = await supabaseCliente360Adapter.listarBacklogCliente("cliente-ficticio");
  expect(filas).toHaveLength(501);
  expect(filas.at(-1)?.id).toBe("0502");
});
