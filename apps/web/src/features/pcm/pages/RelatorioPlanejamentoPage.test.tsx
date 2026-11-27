// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RelatorioPlanejamentoPage } from "./RelatorioPlanejamentoPage";

const listarSemana = vi.hoisted(() => vi.fn(async () => []));
vi.mock("../infrastructure/supabase-agenda-tecnico-adapter", () => ({
  supabaseAgendaTecnicoAdapter: { listarSemana },
}));
vi.mock("../infrastructure/supabase-hub-os-adapter", () => ({
  supabaseHubOsAdapter: { listarOrdensServico: async () => [] },
}));
vi.mock("../application/agenda-tecnico", () => ({ listarOpcoesAgenda: async () => [[], []] }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("consulta a data local vigente a cada abertura do relatório", async () => {
  vi.setSystemTime(new Date(2026, 10, 26, 23, 30));
  const primeiro = render(<RelatorioPlanejamentoPage />);
  await act(async () => {});
  expect(screen.getByLabelText("Data")).toHaveValue("2026-11-26");
  await waitFor(() => expect(listarSemana).toHaveBeenLastCalledWith("2026-11-26", "2026-11-26"));
  primeiro.unmount();

  vi.setSystemTime(new Date(2026, 10, 27, 0, 1));
  render(<RelatorioPlanejamentoPage />);
  await act(async () => {});
  expect(screen.getByLabelText("Data")).toHaveValue("2026-11-27");
  await waitFor(() => expect(listarSemana).toHaveBeenLastCalledWith("2026-11-27", "2026-11-27"));
});
