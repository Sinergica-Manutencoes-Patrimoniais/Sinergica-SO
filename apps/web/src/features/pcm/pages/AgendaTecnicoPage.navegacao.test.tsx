import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AgendaTecnicoPage } from "./AgendaTecnicoPage";

const { listarAgendaProjetada } = vi.hoisted(() => ({
  listarAgendaProjetada: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "teste" } }) }));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar: () => true }),
}));
vi.mock("../../../config/flags-sso", () => ({ flagLigada: () => true }));
vi.mock("../infrastructure/supabase-agenda-projecao-adapter", () => ({ listarAgendaProjetada }));
vi.mock("../infrastructure/supabase-agenda-tecnico-adapter", () => ({
  supabaseAgendaTecnicoAdapter: {},
}));

afterEach(cleanup);

it("nomeia as duas direções da navegação semanal", async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AgendaTecnicoPage />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(listarAgendaProjetada).toHaveBeenCalledTimes(1));
  const anterior = screen.getByRole("button", { name: "Semana anterior" });
  const seguinte = screen.getByRole("button", { name: "Próxima semana" });
  fireEvent.click(anterior);
  await waitFor(() => expect(listarAgendaProjetada).toHaveBeenCalledTimes(2));
  expect(
    String(listarAgendaProjetada.mock.calls[1]?.[0]) <
      String(listarAgendaProjetada.mock.calls[0]?.[0]),
  ).toBe(true);
  fireEvent.click(seguinte);
  await waitFor(() => expect(listarAgendaProjetada).toHaveBeenCalledTimes(3));
  expect(listarAgendaProjetada.mock.calls[2]?.[0]).toBe(listarAgendaProjetada.mock.calls[0]?.[0]);
});
