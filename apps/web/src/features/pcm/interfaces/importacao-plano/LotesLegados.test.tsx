// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LotesLegados } from "./LotesLegados";

const userId = "00000000-0000-4000-8000-000000000001";
const clienteId = "00000000-0000-4000-8000-000000000002";
const lote = { id: "00000000-0000-4000-8000-000000000003", fonte: "Rimini", revisao: 2, criadoEm: "2026-10-30T00:00:00Z", reconciliado: false };
afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });
it("mostra lote selecionado com revisão e formulário de reconciliação", async () => {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const listar = vi.fn().mockResolvedValue([lote]);
  render(<QueryClientProvider client={cliente}><LotesLegados userId={userId} clienteId={clienteId} listar={listar} enviar={vi.fn()} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Conferir Rimini" }));
  expect(screen.getByLabelText("Motivo da reconciliação")).toBeInTheDocument();
  expect(screen.getByText(/revisão 2/)).toBeInTheDocument();
});

it("não mostra lotes anteriores enquanto consulta outro Cliente", async () => {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const listar = vi.fn((id: string) => id === clienteId ? Promise.resolve([lote]) : new Promise<typeof lote[]>(() => {}));
  const { rerender } = render(<QueryClientProvider client={cliente}><LotesLegados userId={userId} clienteId={clienteId} listar={listar} enviar={vi.fn()} /></QueryClientProvider>);
  expect(await screen.findByRole("button", { name: "Conferir Rimini" })).toBeInTheDocument();
  rerender(<QueryClientProvider client={cliente}><LotesLegados userId={userId} clienteId="00000000-0000-4000-8000-000000000004" listar={listar} enviar={vi.fn()} /></QueryClientProvider>);
  expect(screen.queryByRole("button", { name: "Conferir Rimini" })).not.toBeInTheDocument();
});
