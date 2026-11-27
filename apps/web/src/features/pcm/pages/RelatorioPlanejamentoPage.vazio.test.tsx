// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RelatorioPlanejamentoPage } from "./RelatorioPlanejamentoPage";

vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));
vi.mock("../application/agenda-tecnico", () => ({ listarOpcoesAgenda: async () => [[], []] }));
vi.mock("../application/relatorio-planejamento", () => ({
  listarItensRelatorioPlanejamento: async () => [],
}));

it("descreve o vazio conforme o modo do relatório", async () => {
  render(<RelatorioPlanejamentoPage />);
  expect(await screen.findByText("Nada planejado para este dia/técnico.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Execução" }));
  expect(
    screen.getByText("Nenhum registro de execução para os filtros selecionados."),
  ).toBeVisible();
});
