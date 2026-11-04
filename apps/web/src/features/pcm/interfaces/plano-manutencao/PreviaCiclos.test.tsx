// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ preverCiclos: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } },
}));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({
  supabasePlanoManutencaoAdapter: api,
}));
import { PreviaCiclos } from "./PreviaCiclos";

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PreviaCiclos userId="u" clienteId="c" planoId="p" versaoId="v" rotinaId="r" />
    </QueryClientProvider>,
  );
}
function consultar(inicio: string, fim: string) {
  fireEvent.change(screen.getByLabelText("Início da prévia"), { target: { value: inicio } });
  fireEvent.change(screen.getByLabelText("Fim da prévia"), { target: { value: fim } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar ciclos" }));
}
it("mostra vencimento em feriado com tolerância zero e aviso de prévia informativa", async () => {
  api.preverCiclos.mockResolvedValue([
    { ciclo: 0, vencimento: "2026-12-25", toleranciaAntes: 0, toleranciaDepois: 0 },
    { ciclo: 1, vencimento: "2027-01-25", toleranciaAntes: 0, toleranciaDepois: 0 },
  ]);
  montar();
  consultar("2026-12-01", "2027-02-01");
  expect(await screen.findByText(/Ciclo 0: 25\/12\/2026/)).toHaveTextContent(
    "Janela: 25/12/2026 a 25/12/2026",
  );
  expect(screen.getByText(/Ciclo 1: 25\/01\/2027/)).toHaveTextContent(
    "Janela: 25/01/2027 a 25/01/2027",
  );
  expect(screen.getByText(/não confere feriados/)).toBeTruthy();
});
it("mostra ciclos mensais retornados com âncora no dia 31", async () => {
  api.preverCiclos.mockResolvedValue([
    { ciclo: 0, vencimento: "2027-01-31", toleranciaAntes: 0, toleranciaDepois: 0 },
    { ciclo: 1, vencimento: "2027-02-28", toleranciaAntes: 0, toleranciaDepois: 0 },
    { ciclo: 2, vencimento: "2027-03-31", toleranciaAntes: 0, toleranciaDepois: 0 },
  ]);
  montar();
  consultar("2027-01-01", "2027-03-31");
  expect(await screen.findByText(/Ciclo 0: 31\/01\/2027/)).toBeTruthy();
  expect(screen.getByText(/Ciclo 1: 28\/02\/2027/)).toBeTruthy();
  expect(screen.getByText(/Ciclo 2: 31\/03\/2027/)).toBeTruthy();
  expect(api.preverCiclos).toHaveBeenCalledWith(
    "p",
    "v",
    "r",
    "2027-01-01",
    "2027-03-31",
    expect.any(AbortSignal),
  );
});
it("não exibe resultado de período antigo quando consulta nova termina primeiro", async () => {
  let concluirAntiga!: (valor: object[]) => void;
  api.preverCiclos
    .mockReturnValueOnce(
      new Promise((resolve) => {
        concluirAntiga = resolve;
      }),
    )
    .mockResolvedValueOnce([
      { ciclo: 2, vencimento: "2027-03-31", toleranciaAntes: 0, toleranciaDepois: 0 },
    ]);
  montar();
  consultar("2027-01-01", "2027-01-31");
  await waitFor(() => expect(api.preverCiclos).toHaveBeenCalledTimes(1));
  consultar("2027-03-01", "2027-03-31");
  expect(await screen.findByText(/Ciclo 2: 31\/03\/2027/)).toBeTruthy();
  concluirAntiga([{ ciclo: 0, vencimento: "2027-01-31", toleranciaAntes: 0, toleranciaDepois: 0 }]);
  await Promise.resolve();
  expect(screen.queryByText(/Ciclo 0: 31\/01\/2027/)).toBeNull();
  expect(screen.getByText(/Ciclo 2: 31\/03\/2027/)).toBeTruthy();
});
it("revalidação recusada oculta resultado anterior e permite nova tentativa", async () => {
  api.preverCiclos
    .mockResolvedValueOnce([
      { ciclo: 0, vencimento: "2026-12-25", toleranciaAntes: 0, toleranciaDepois: 0 },
    ])
    .mockRejectedValueOnce(new Error("acesso negado"))
    .mockResolvedValueOnce([
      { ciclo: 0, vencimento: "2026-12-25", toleranciaAntes: 0, toleranciaDepois: 0 },
    ]);
  montar();
  consultar("2026-12-01", "2026-12-31");
  expect(await screen.findByText(/Ciclo 0: 25\/12\/2026/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Consultar ciclos" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText(/Ciclo 0: 25\/12\/2026/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText(/Ciclo 0: 25\/12\/2026/)).toBeTruthy();
});
