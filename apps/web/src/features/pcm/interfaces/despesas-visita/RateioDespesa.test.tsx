// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listar: vi.fn(), atual: vi.fn(), ratear: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "18010000-0000-0000-0000-000000000001" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-despesas-visita-adapter", async (importOriginal) => {
 const original = await importOriginal<typeof import("../../infrastructure/supabase-despesas-visita-adapter")>();
 return { ...original, consultarOsParaRateio: mocks.listar, consultarRateio: mocks.atual, ratearDespesa: mocks.ratear };
});
import { RateioDespesa } from "./RateioDespesa";

const userId = "18010000-0000-0000-0000-000000000001";
const cliente = "18010000-0000-0000-0000-00000000000a";
const clienteB = "18010000-0000-0000-0000-00000000000b";
const visita = "18010000-0000-0000-0000-000000000021";
const despesaId = "18010000-0000-0000-0000-000000000051";
const vinculo1 = "18010000-0000-0000-0000-000000000031";
const vinculo2 = "18010000-0000-0000-0000-000000000032";
const despesa = { id: despesaId, descricao: "Deslocamento", data: "2026-11-01", previstoCentavos: 12000, realizadoCentavos: 10000, status: "ativa" as const, revisao: 7 };
function montar(conta = cliente) {
 const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
 return render(<QueryClientProvider client={queryClient}><RateioDespesa userId={userId} clienteId={conta} visitaId={visita} despesa={despesa} /></QueryClientProvider>);
}
beforeEach(() => {
 sessionStorage.clear(); vi.stubEnv("VITE_SSO_RATEIO_DESPESAS_VISITA_ENABLED", "true");
 mocks.listar.mockReset().mockImplementation(async (conta: string) => conta === cliente ? [{ id: vinculo1, numero: "OS A1", titulo: "Primeira" }, { id: vinculo2, numero: "OS A2", titulo: "Segunda" }] : []);
 mocks.atual.mockReset().mockResolvedValue([]); mocks.ratear.mockReset().mockResolvedValue({});
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("rateio de despesa da Visita", () => {
 it("recusa soma parcial e envia o total realizado com revisão da despesa", async () => {
  montar();
  const primeira = await screen.findByLabelText("OS A1 — Primeira");
  const segunda = screen.getByLabelText("OS A2 — Segunda");
  fireEvent.change(primeira, { target: { value: "6000" } });
  fireEvent.change(segunda, { target: { value: "3000" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar rateio" }));
  expect(mocks.ratear).not.toHaveBeenCalled();
  expect(screen.getByText(/soma diferente da base/i)).toBeTruthy();
  fireEvent.change(segunda, { target: { value: "4000" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar rateio" }));
  await waitFor(() => expect(mocks.ratear.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ despesaId, visitaId: visita, expectedRevision: 7, parcelas: [{ vinculoId: vinculo1, valorCentavos: 6000 }, { vinculoId: vinculo2, valorCentavos: 4000 }] })));
 });

 it("reconsulta OS com a Conta atual sem reaproveitar seleção de outra Conta", async () => {
  const { unmount } = montar();
  await screen.findByLabelText("OS A1 — Primeira");
  unmount(); montar(clienteB);
  await waitFor(() => expect(mocks.listar).toHaveBeenCalledWith(clienteB, visita, null, expect.any(AbortSignal)));
  expect(screen.queryByLabelText("OS A1 — Primeira")).toBeNull();
 });

 it("mantém tentativa incerta e repete os mesmos dados", async () => {
  mocks.ratear.mockRejectedValueOnce(new Error("resposta incerta")).mockResolvedValueOnce({});
  montar();
  fireEvent.change(await screen.findByLabelText("OS A1 — Primeira"), { target: { value: "10000" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar rateio" }));
  expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();
  const primeiro = mocks.ratear.mock.calls[0]?.[0];
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  await waitFor(() => expect(mocks.ratear).toHaveBeenCalledTimes(2));
  expect(mocks.ratear.mock.calls[1]?.[0]).toEqual(primeiro);
 });

 it("carrega o rateio existente para edição sem gravar", async () => {
  mocks.atual.mockResolvedValue([{ revisao: 2, vinculo_id: vinculo1, os_id: "18010000-0000-0000-0000-000000000061", valor_centavos: 6000, vinculo_vigente: true },
   { revisao: 2, vinculo_id: vinculo2, os_id: "18010000-0000-0000-0000-000000000062", valor_centavos: 4000, vinculo_vigente: true }]);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Carregar rateio atual" }));
  expect((screen.getByLabelText("OS A1 — Primeira") as HTMLInputElement).value).toBe("6000");
  expect((screen.getByLabelText("OS A2 — Segunda") as HTMLInputElement).value).toBe("4000");
  expect(mocks.ratear).not.toHaveBeenCalled();
 });

 it("exige confirmação antes de substituir a edição em andamento", async () => {
  mocks.atual.mockResolvedValue([{ revisao: 2, vinculo_id: vinculo1, os_id: "18010000-0000-0000-0000-000000000061", valor_centavos: 10000, vinculo_vigente: true }]);
  montar();
  const campo = await screen.findByLabelText("OS A1 — Primeira") as HTMLInputElement;
  fireEvent.change(campo, { target: { value: "5000" } });
  fireEvent.click(screen.getByRole("button", { name: "Carregar rateio atual" }));
  expect(campo.value).toBe("5000");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar substituição dos valores" }));
  expect(campo.value).toBe("10000");
  expect(mocks.ratear).not.toHaveBeenCalled();
 });

 it("não carrega rateio com vínculo não vigente", async () => {
  mocks.atual.mockResolvedValue([{ revisao: 2, vinculo_id: vinculo1, os_id: "18010000-0000-0000-0000-000000000061", valor_centavos: 10000, vinculo_vigente: false }]);
  montar();
  expect(await screen.findByText(/vínculo não vigente ou não encontrado/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Carregar rateio atual" })).toBeNull();
  expect(mocks.ratear).not.toHaveBeenCalled();
 });
});
