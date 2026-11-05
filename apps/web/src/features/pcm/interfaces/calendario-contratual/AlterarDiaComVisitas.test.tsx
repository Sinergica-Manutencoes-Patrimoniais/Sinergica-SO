// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({
        data: { user: { id: "17600000-0000-4000-8000-000000000001" } },
        error: null,
      }),
    },
    schema: () => ({ rpc: api.rpc }),
  },
}));
import { AlterarDiaComVisitas } from "./AlterarDiaComVisitas";
const id = (n: number) => `17600000-0000-4000-8000-${String(n).padStart(12, "0")}`;
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});
for (const incerta of [false, true])
  for (const code of ["40001", "P0018"])
    it(`${
      incerta
        ? "mantém replay após falha de rede e rejeição posterior"
        : "permite nova conferência após rejeição definitiva inicial"
    } ${code}`, async () => {
      let envios = 0;
      api.rpc.mockImplementation((nome: string) => {
        if (nome.startsWith("sso_prever_"))
          return {
            abortSignal: async () => ({
              data: [
                {
                  visita_id: id(4),
                  semana_origem: "2026-11-02",
                  regra_origem_id: id(5),
                  inicio_em: "2026-11-06T12:00:00Z",
                  estado: "planejada",
                  revisao: 1,
                  data_proposta: "2026-11-03",
                  classificacao: "candidata_revisao",
                },
              ],
              error: null,
            }),
          };
        envios++;
        return Promise.resolve({
          data: null,
          error:
            incerta && envios === 1 ? new Error("rede") : { code, message: "impactos_alterados" },
        });
      });
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={client}>
          <AlterarDiaComVisitas
            userId={id(1)}
            clienteId={id(2)}
            serieId={id(3)}
            revisao={1}
            dia={2}
            vigencia="2026-11-02"
            bloqueado={false}
          />
        </QueryClientProvider>,
      );
      await screen.findByText(/1 Visita\(s\) carregada/);
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Alterar regra e Visitas" }));
      if (incerta) {
        fireEvent.click(await screen.findByRole("button", { name: "Repetir mesmo pedido" }));
        await screen.findByText(/Resultado não confirmado/);
        expect(sessionStorage.length).toBe(1);
      } else if (code === "P0018") {
        await screen.findByText(/Regra ou Visitas mudaram/);
        expect(sessionStorage.length).toBe(0);
        expect(screen.queryByRole("button", { name: "Repetir mesmo pedido" })).toBeNull();
      } else {
        await screen.findByText(/Resultado não confirmado/);
        expect(sessionStorage.length).toBe(1);
        expect(screen.getByRole("button", { name: "Repetir mesmo pedido" })).toBeTruthy();
      }
    });
