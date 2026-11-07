// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const gateway = vi.hoisted(() => ({
  autorizar: vi.fn(),
  disponibilidades: vi.fn(),
  vinculos: vi.fn(),
}));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: { autorizarAcao: gateway.autorizar },
}));
vi.mock("../../infrastructure/supabase-capacidade-agenda-adapter", () => ({
  listarDisponibilidades: gateway.disponibilidades,
  listarVinculosCapacidade: gateway.vinculos,
}));
vi.mock("./Formulario", () => ({ FormularioDisponibilidade: () => null }));
vi.mock("./IntervalosDeclarados", () => ({ IntervalosDeclarados: () => null }));
vi.mock("./FontesDemanda", () => ({ FontesDemanda: () => null }));
vi.mock("./DiagnosticoConflitos", () => ({ DiagnosticoConflitos: () => null }));
vi.mock("./ConflitosInterclientes", () => ({ ConflitosInterclientes: () => null }));
vi.mock("./HorizonteCapacidade", () => ({ HorizonteCapacidade: () => null }));
vi.mock("./OcorrenciasSemOs", () => ({ OcorrenciasSemOs: () => null }));
vi.mock("./SnapshotCapacidade", () => ({ SnapshotCapacidade: () => null }));
import { CapacidadeAgendaWorkspace } from "./Workspace";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("consulta a semana do domingo selecionado, sem misturar Cliente", async () => {
  gateway.autorizar.mockResolvedValue(true);
  gateway.disponibilidades.mockResolvedValue([]);
  gateway.vinculos.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CapacidadeAgendaWorkspace userId="usuario" clienteId="cliente-a" />
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByLabelText(/Data da semana/), {
    target: { value: "2027-01-03" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
  await screen.findByText("Semana: 2026-12-28 a 2027-01-03 (segunda a domingo).");
  await waitFor(() =>
    expect(gateway.disponibilidades).toHaveBeenCalledWith(
      "cliente-a",
      "2026-12-28",
      null,
      expect.any(AbortSignal),
    ),
  );
  expect(gateway.vinculos).toHaveBeenCalledWith(
    "cliente-a",
    "2026-12-28",
    null,
    expect.any(AbortSignal),
  );
});

it("relaciona disponibilidade e Visitas do técnico sem afirmar saldo", async () => {
  gateway.autorizar.mockResolvedValue(true);
  gateway.disponibilidades.mockResolvedValue([{ id: "d", funcionarioId: "f", destinadosMinutos: 600, reservasMinutos: 60, ausenciasMinutos: 30, disponiveisMinutos: 510, revisao: 1 }]);
  gateway.vinculos.mockResolvedValue([{ id: "v", visitaId: "visita", funcionarioId: "f", estimativaMinutos: 120 }]);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CapacidadeAgendaWorkspace userId="usuario" clienteId="cliente-a" /></QueryClientProvider>);
  fireEvent.change(await screen.findByLabelText(/Data da semana/), { target: { value: "2027-01-03" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
  expect(await screen.findByText(/disponibilidade declarada 510 min.*120 min estimados/i)).toBeTruthy();
  expect(screen.getByText(/consultas independentes.*não comprova execução/i)).toBeTruthy();
});
