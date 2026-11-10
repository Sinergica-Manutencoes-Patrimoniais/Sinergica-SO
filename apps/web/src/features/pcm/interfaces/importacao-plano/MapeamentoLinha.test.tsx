// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const chamadas = vi.hoisted(() => ({ mapear: vi.fn() }));
vi.mock("../../infrastructure/supabase-importacao-plano-adapter", () => ({
  listarAlvosCronograma: vi.fn().mockResolvedValue([{ id: "alvo", nome: "Sistema de teste" }]),
  listarMapeamentosCronograma: vi.fn().mockResolvedValue([]),
  mapearLinhaCronograma: chamadas.mapear,
}));
import { MapeamentoLinha } from "./MapeamentoLinha";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); });

it("recusa premissa incompatível antes de guardar tentativa e permite corrigir", async () => {
  chamadas.mapear.mockResolvedValue({});
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MapeamentoLinha userId="u" clienteId="c" loteId="l" revisao={1} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Linha"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Disciplina"), { target: { value: "Hidráulica" } });
  fireEvent.change(screen.getByLabelText("Nome da Rotina"), { target: { value: "Inspeção" } });
  await screen.findByRole("option", { name: "Sistema de teste" });
  fireEvent.change(screen.getByLabelText("Alvo existente"), { target: { value: "alvo" } });
  fireEvent.change(screen.getByLabelText("Data-base"), { target: { value: "2026-08-05" } });
  fireEvent.change(screen.getByLabelText("Premissa mensal da fonte"), { target: { value: "quatro_semanas" } });
  fireEvent.submit(screen.getByRole("button", { name: "Guardar mapeamento" }).closest("form")!);
  expect(chamadas.mapear).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
  expect(screen.getByRole("status")).toHaveTextContent("Quatro semanas");
  fireEvent.change(screen.getByLabelText("Intervalo"), { target: { value: "4" } });
  fireEvent.change(screen.getByLabelText("Unidade"), { target: { value: "semanas" } });
  fireEvent.submit(screen.getByRole("button", { name: "Guardar mapeamento" }).closest("form")!);
  await waitFor(() => expect(chamadas.mapear).toHaveBeenCalledOnce());
  expect(chamadas.mapear.mock.calls[0]?.[0]).toMatchObject({ intervalo: 4, unidade: "semanas", premissaMensal: "quatro_semanas" });
  await screen.findByText("Mapeamento registrado para conferência; nenhuma Rotina foi criada.");
});

it("exige meses para calendário real antes de preservar uma tentativa", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MapeamentoLinha userId="u" clienteId="c" loteId="l" revisao={1} /></QueryClientProvider>);
  await screen.findByRole("option", { name: "Sistema de teste" });
  fireEvent.change(screen.getByLabelText("Linha"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Unidade"), { target: { value: "semanas" } });
  fireEvent.change(screen.getByLabelText("Premissa mensal da fonte"), { target: { value: "calendario_real" } });
  fireEvent.submit(screen.getByRole("button", { name: "Guardar mapeamento" }).closest("form")!);
  expect(chamadas.mapear).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
  expect(screen.getByRole("status")).toHaveTextContent("Calendário real exige unidade meses");
});
