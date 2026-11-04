// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } } }));
import { ResolverRetiradaImpacto } from "./ResolverRetiradaImpacto";

const clienteId = "16630000-1111-4000-8000-000000000001";
const planoId = "16630000-1111-4000-8000-000000000002";
const rascunhoId = "16630000-1111-4000-8000-000000000003";
const preparadaId = "16630000-1111-4000-8000-000000000004";
const props = { userId: "usuario", clienteId, planoId, rascunhoId, preparadaId, planoRevision: 2, decisaoRevision: 1, tipo: "calendario" as const };
const chave = `sso-retirada-impacto:${JSON.stringify([props.userId, clienteId, planoId, rascunhoId, preparadaId, 1, "calendario"])}`;
const pedido = JSON.stringify({ requestId: "16630000-1111-4000-8000-000000000005", clienteId, planoId, rascunhoId, preparadaId, planoRevision: 2, decisaoRevision: 1, tipo: "calendario", motivo: "Conferido" });
const montar = () => { vi.stubEnv("VITE_SSO_RESOLUCAO_IMPACTO_ENABLED", "true"); return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><ResolverRetiradaImpacto {...props} /></QueryClientProvider>); };
const prepararApi = (erros: string[]) => { let indice = 0; api.rpc.mockImplementation((nome: string) => nome === "sso_consultar_resolucao_impacto_v2" ? { abortSignal: () => Promise.resolve({ data: { preparadaId, revisaoDecisao: 1, resolvida: false, motivo: null, resolucaoObsoleta: false }, error: null }) } : Promise.resolve({ data: null, error: { code: erros[indice++] } })); };
const registrar = async () => { const motivo = await screen.findByLabelText("Motivo"); fireEvent.change(motivo, { target: { value: "Conferido" } }); fireEvent.click(screen.getByRole("checkbox", { name: /Confirmo retirar/ })); fireEvent.click(screen.getByRole("button", { name: "Registrar retirada" })); };
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); api.rpc.mockReset(); });

it("libera somente a primeira rejeição definitiva e exige nova confirmação", async () => {
  prepararApi(["40001"]); montar(); await registrar();
  await screen.findByText(/A revisão ou decisão mudou/);
  expect(sessionStorage.getItem(chave)).toBeNull();
  expect(screen.queryByRole("button", { name: "Repetir tentativa pendente" })).toBeNull();
  await waitFor(() => expect(screen.getByRole("checkbox", { name: /Confirmo retirar/ })).not.toBeChecked());
});

it("preserva pedido após resultado incerto seguido de conflito", async () => {
  prepararApi(["timeout", "40001"]); montar(); await registrar();
  await screen.findByText(/Resultado não confirmado/);
  const salvo = sessionStorage.getItem(chave); expect(salvo).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(api.rpc.mock.calls.filter(([nome]) => nome === "sso_resolver_impacto_retirada")).toHaveLength(2));
  await waitFor(() => expect(screen.getByRole("button", { name: "Repetir tentativa pendente" })).toBeEnabled());
  expect(sessionStorage.getItem(chave)).toBe(salvo);
});

it("preserva pedido recuperado quando repetição recebe conflito", async () => {
  sessionStorage.setItem(chave, pedido); prepararApi(["40001"]); montar();
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(sessionStorage.getItem(chave)).toBe(pedido);
  expect(api.rpc.mock.calls.find(([nome]) => nome === "sso_resolver_impacto_retirada")?.[1]).toMatchObject({ p_request_id: JSON.parse(pedido).requestId });
});
