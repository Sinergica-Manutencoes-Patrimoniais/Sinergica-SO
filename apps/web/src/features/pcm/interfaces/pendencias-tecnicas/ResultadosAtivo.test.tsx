// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc }), auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u" } }, error: null }) } } }));
import { ResultadosAtivo } from "./ResultadosAtivo";

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllEnvs(); });

it("oculta resultados antigos durante nova consulta e após erro até confirmação atual", async () => {
  vi.stubEnv("VITE_SSO_RESULTADOS_ATIVO_ENABLED", "true");
  const registro = { resposta_id: "11111111-1111-4111-8111-111111111111", retorno_id: "22222222-2222-4222-8222-222222222222", os_id: "33333333-3333-4333-8333-333333333333", chave_pergunta: "Falha exclusiva", resultado: "nao_ok", observacao: null, fotos_registradas: 0, decisao_retorno: null };
  let finalizar!: (resultado: { data: null; error: Error }) => void;
  rpc.mockImplementationOnce(() => ({ abortSignal: async () => ({ data: [registro], error: null }) }))
    .mockImplementationOnce(() => ({ abortSignal: () => new Promise(resolve => { finalizar = resolve; }) }))
    .mockImplementationOnce(() => ({ abortSignal: async () => ({ data: [registro], error: null }) }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ResultadosAtivo userId="u" clienteId="c" alvos={[{ alvo_tipo: "sistema", alvo_id: "a", alvo_nome: "Sistema A" }]} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Ver resultados por ativo" }));
  fireEvent.change(screen.getByLabelText("Ativo"), { target: { value: JSON.stringify(["sistema", "a"]) } });
  expect(await screen.findByText(/Falha exclusiva/)).toBeInTheDocument();
  act(() => { void client.invalidateQueries({ queryKey: ["pendencias-resultados-ativo"] }); });
  await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
  expect(screen.queryByText(/Falha exclusiva/)).not.toBeInTheDocument();
  await act(async () => finalizar({ data: null, error: new Error("acesso negado") }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Resultados indisponíveis");
  expect(screen.queryByText(/Falha exclusiva/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText(/Falha exclusiva/)).toBeInTheDocument();
});
