// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) },
    schema: () => ({ rpc: api.rpc }),
  },
}));
import { DecisaoFeriadoCalendario } from "./DecisaoFeriadoCalendario";
const id = (n: number) => `16630000-1111-4000-8000-${String(n).padStart(12, "0")}`;
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});
it.each(["primeira", "replay"] as const)("preserva semântica de P0018 em %s", async (cenario) => {
  let n = 0;
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_listar_feriados_ciclo"
      ? {
          abortSignal: async () => ({
            data: {
              preparadaExiste: true,
              preparadaId: id(6),
              vencimentoOriginal: "2026-11-05",
              revisao: 1,
              feriados: [{ id: id(7), fonte: "PCM", revisao: 1 }],
              fonteCompleta: false,
            },
            error: null,
          }),
        }
      : Promise.resolve({
          data: null,
          error:
            cenario === "replay" && n++ === 0
              ? new Error("rede")
              : { code: "P0018", message: "revisao_obsoleta" },
        }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <DecisaoFeriadoCalendario
        userId="usuario"
        clienteId={id(2)}
        planoId={id(3)}
        versaoId={id(4)}
        rotinaId={id(5)}
        ciclo={1}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Conferir decisão de feriado" }));
  await screen.findByRole("option", { name: /PCM/ });
  fireEvent.change(screen.getByLabelText("Feriado geral declarado"), { target: { value: id(7) } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Registrar tratamento PCM" }));
  if (cenario === "primeira") {
    await screen.findByText(/Os dados mudaram/);
    expect(sessionStorage.length).toBe(0);
  } else {
    fireEvent.click(await screen.findByRole("button", { name: "Repetir tentativa pendente" }));
    await waitFor(() => expect(n).toBeGreaterThanOrEqual(2));
    expect(sessionStorage.length).toBe(1);
  }
});
