// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000001" } }, error: null }) },
  schema: () => ({ rpc: api.rpc }),
} }));
import { RascunhoPlanoLegado } from "./RascunhoPlanoLegado";

const usuario = "00000000-0000-4000-8000-000000000001";
const cliente = "00000000-0000-4000-8000-000000000002";
const plano = "00000000-0000-4000-8000-000000000003";
const questionario = "00000000-0000-4000-8000-000000000004";
const tipoTarefa = "00000000-0000-4000-8000-000000000005";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); });

it("mantém dados digitados e bloqueia criação enquanto o inventário é reconsultado", async () => {
  api.rpc.mockReturnValue({ abortSignal: async () => ({ data: { clienteId: cliente, planoLegadoId: plano,
    fotografia: { id: plano, cliente_id: cliente, nome: "Plano legado", questionario_id: questionario,
      tipo_tarefa_id: tipoTarefa, primeira_data: "2026-10-01", intervalo_n: 1, intervalo_unidade: "meses",
      sistema_id: null, equipamento_id: null }, rascunhoExistente: false, equivalenciaComprovada: false }, error: null }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tela = (disponivel: boolean) => <QueryClientProvider client={client}><RascunhoPlanoLegado userId={usuario} clienteId={cliente} planoId={plano} disponivel={disponivel} /></QueryClientProvider>;
  const { rerender } = render(tela(true));
  const intervalo = await screen.findByLabelText("Intervalo") as HTMLInputElement;
  fireEvent.change(intervalo, { target: { value: "3" } });
  rerender(tela(false));
  expect((screen.getByLabelText("Intervalo") as HTMLInputElement).value).toBe("3");
  expect(screen.getByText(/plano não confirmado/i)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Criar rascunho" }) as HTMLButtonElement).disabled).toBe(true);
});
