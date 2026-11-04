// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: {
  schema: () => ({ rpc: mocks.rpc }),
  auth: { getUser: async () => ({ data: { user: { id: "18010000-0000-4000-8000-000000000001" } }, error: null }) },
} }));
import { AprovacaoParcial, SelecionarAprovacaoParcial } from "./AprovacaoParcial";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("informa recusa do pai e preserva a tentativa de aprovação", async () => {
  vi.stubEnv("VITE_SSO_APROVACAO_PARCIAL_ENABLED", "true");
  const userId = "18010000-0000-4000-8000-000000000001";
  const clienteId = "18010000-0000-4000-8000-000000000002";
  const loteId = "18010000-0000-4000-8000-000000000003";
  mocks.rpc.mockImplementation((nome: string) => nome === "sso_retrato_aprovacao_autorizado"
    ? { abortSignal: async () => ({ data: { loteId, chave: "filho", revision: 1, atributos: {}, camposEstruturados: null, codigoRevision: 0, aprovacaoParcialVigente: false, previsaoNaoAprova: true }, error: null }) }
    : Promise.resolve({ data: null, error: { code: "23514", message: "pai_nao_aprovado_ou_rejeitado" } }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><AprovacaoParcial userId={userId} clienteId={clienteId} loteId={loteId} revisao={1}>
    <SelecionarAprovacaoParcial userId={userId} clienteId={clienteId} loteId={loteId} chave="filho" revisao={1} atributos={{}} />
  </AprovacaoParcial></QueryClientProvider>);
  const selecionar = await screen.findByRole("button", { name: "Selecionar linha conferida para aprovação parcial" });
  await vi.waitFor(() => expect(selecionar).toBeEnabled());
  fireEvent.click(selecionar);
  fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Conferência" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi os retratos/ }));
  fireEvent.click(screen.getByRole("button", { name: "Aprovar seleção" }));
  await screen.findByText(/Aprovação recusada: confira a situação das linhas-pai/);
  expect(sessionStorage.getItem(`sso-aprovacao-parcial:${JSON.stringify([userId, clienteId, loteId])}`)).not.toBeNull();
});

for (const estado of ["cancelado", "confirmado"] as const) {
  it(`trata cancelamento com resposta ${estado} sem duplicar aprovação`, async () => {
    vi.stubEnv("VITE_SSO_APROVACAO_PARCIAL_ENABLED", "true");
    vi.stubEnv("VITE_SSO_CANCELAR_TENTATIVA_APROVACAO_ENABLED", "true");
    const userId = "18010000-0000-4000-8000-000000000001";
    const clienteId = "18010000-0000-4000-8000-000000000002";
    const loteId = "18010000-0000-4000-8000-000000000003";
    const requestId = "18010000-0000-4000-8000-000000000004";
    const chave = `sso-aprovacao-parcial:${JSON.stringify([userId, clienteId, loteId])}`;
    const pedido = { requestId, loteId, revision: 1, itens: [{ chave: "filho", atributos: {}, camposEstruturados: null, codigoRevision: 0, revisaoSelecao: 1 }], motivo: "Conferência" };
    sessionStorage.setItem(chave, JSON.stringify(pedido));
    mocks.rpc.mockResolvedValueOnce({ data: { requestId, loteId, estado }, error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><AprovacaoParcial userId={userId} clienteId={clienteId} loteId={loteId} revisao={1}>{null}</AprovacaoParcial></QueryClientProvider>);
    fireEvent.click(screen.getByRole("checkbox", { name: /Confirmo cancelar esta tentativa/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar tentativa" }));
    if (estado === "cancelado") {
      await screen.findByText(/Tentativa cancelada/);
      expect(sessionStorage.getItem(chave)).toBeNull();
    } else {
      await screen.findByText(/aprovação já foi registrada/);
      expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
    }
    expect(mocks.rpc).toHaveBeenCalledWith("sso_cancelar_tentativa_aprovacao", {
      p_request_id: requestId, p_ator_esperado: userId, p_cliente_id: clienteId, p_lote_id: loteId,
    });
  });
}
