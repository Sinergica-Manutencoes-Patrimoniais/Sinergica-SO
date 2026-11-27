import { expect, it, vi } from "vitest";
import { supabaseCliente360Adapter } from "./supabase-cliente-360-adapter";

vi.mock("../../../lib/supabase-client", () => ({
  supabase: {
    schema: () => ({
      from: (tabela: string) => {
        const equipamentos = [
          { auvo_equipment_id: null, updated_at: "2026-11-25T20:00:00Z" },
          { auvo_equipment_id: 321, updated_at: "2026-11-25T18:00:00Z" },
        ];
        let linhas = tabela === "equipamentos" ? equipamentos : [];
        const consulta = {
          select: () => consulta,
          eq: () => consulta,
          is: () => consulta,
          not: (coluna: string, operador: string, valor: unknown) => {
            expect([coluna, operador, valor]).toEqual(["auvo_equipment_id", "is", null]);
            linhas = linhas.filter((linha) => linha.auvo_equipment_id !== null);
            return consulta;
          },
          order: () => consulta,
          limit: (limite: number) => ({ data: linhas.slice(0, limite), error: null }),
          maybeSingle: () => ({ data: { auvo_id: 12 }, error: null }),
          data: [],
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
