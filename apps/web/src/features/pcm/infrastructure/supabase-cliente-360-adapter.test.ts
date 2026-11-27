import { expect, it, vi } from "vitest";
import { supabaseCliente360Adapter } from "./supabase-cliente-360-adapter";

const banco = vi.hoisted(() => ({
  ordens: [] as Record<string, unknown>[],
}));
vi.mock("../../../lib/supabase-client", () => ({
  supabase: {
    schema: () => ({
      from: (tabela: string) => {
        const equipamentos = [
          { auvo_equipment_id: null, updated_at: "2026-11-25T20:00:00Z" },
          { auvo_equipment_id: 321, updated_at: "2026-11-25T18:00:00Z" },
        ];
        let limiteConsulta = 500;
        let linhas: Record<string, unknown>[] =
          tabela === "equipamentos"
            ? equipamentos
            : tabela === "ordens_servico"
              ? banco.ordens
              : [];
        if (tabela === "clientes") linhas = [{ id: "cliente-ficticio", nome: "Cliente fictício" }];
        const consulta = {
          select: () => consulta,
          eq: () => consulta,
          is: () => consulta,
          neq: () => consulta,
          gt: (campo: string, valor: string) => {
            linhas = linhas.filter((linha) => String(linha[campo]) > valor);
            return consulta;
          },
          not: (coluna: string, operador: string, valor: unknown) => {
            expect([coluna, operador, valor]).toEqual(["auvo_equipment_id", "is", null]);
            linhas = linhas.filter((linha) => linha.auvo_equipment_id !== null);
            return consulta;
          },
          order: () => consulta,
          limit: (limite: number) => {
            limiteConsulta = limite;
            return consulta;
          },
          maybeSingle: () => ({ data: { auvo_id: 12 }, error: null }),
          get data() {
            return linhas.slice(0, limiteConsulta);
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

it("DEF-40: conta as OS em todas as páginas da carteira e exclui estados históricos", async () => {
  banco.ordens = Array.from({ length: 503 }, (_, indice) => ({
    id: String(indice).padStart(4, "0"),
    client_id: indice < 500 ? "outro-cliente" : "cliente-ficticio",
    status: indice === 502 ? "finalizado" : "planejamento",
    score_pcm: 3,
    created_at: "2026-11-25T00:00:00Z",
    auvo_synced_at: null,
  }));
  expect(await supabaseCliente360Adapter.listarClientes()).toEqual([
    expect.objectContaining({ id: "cliente-ficticio", osAbertas: 2 }),
  ]);
});
