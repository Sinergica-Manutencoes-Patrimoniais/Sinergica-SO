// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    schema: () => ({ rpc: api.rpc }),
    auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) },
  },
}));
import { PrecondicaoImpactos } from "./PrecondicaoImpactos";
const chave = `sso-precondicao-impactos:${JSON.stringify(["u", "c", "p"])}`;
const montar = () => {
  vi.stubEnv("VITE_SSO_PRECONDICAO_IMPACTO_MEDIADA_ENABLED", "true");
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <PrecondicaoImpactos userId="u" clienteId="c" planoId="p" revisao={1} vigencia="2026-11-01" />
    </QueryClientProvider>,
  );
};
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
  api.rpc.mockReset();
});

it("não substitui tentativa guardada que apareceu depois da abertura", async () => {
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [], error: null }) });
  montar();
  await screen.findByText("Histórico paginado por identificador, não ordenado por data.");
  const anterior = JSON.stringify({
    requestId: "pedido-anterior",
    clienteId: "c",
    planoId: "p",
    revisao: 1,
    vigencia: "2026-11-01",
  });
  sessionStorage.setItem(chave, anterior);
  fireEvent.click(screen.getByLabelText(/Confirmo apenas registrar/));
  fireEvent.click(screen.getByRole("button", { name: "Registrar fotografia" }));
  expect(sessionStorage.getItem(chave)).toBe(anterior);
  expect(
    api.rpc.mock.calls.filter(([nome]) => nome === "sso_registrar_precondicao_impacto_mediada"),
  ).toHaveLength(0);
});

it("impede envios simultâneos e não apaga tentativa divergente após confirmação", async () => {
  let finalizar: ((v: unknown) => void) | undefined;
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_listar_precondicoes_impacto_mediada"
      ? { abortSignal: () => Promise.resolve({ data: [], error: null }) }
      : new Promise((resolve) => {
          finalizar = resolve;
        }),
  );
  montar();
  fireEvent.click(screen.getByLabelText(/Confirmo apenas registrar/));
  const botao = screen.getByRole("button", { name: "Registrar fotografia" });
  act(() => {
    fireEvent.click(botao);
    fireEvent.click(botao);
  });
  await waitFor(() =>
    expect(
      api.rpc.mock.calls.filter(([nome]) => nome === "sso_registrar_precondicao_impacto_mediada"),
    ).toHaveLength(1),
  );
  const pedido = JSON.parse(sessionStorage.getItem(chave)!);
  const divergente = JSON.stringify({ ...pedido, requestId: "outro-pedido" });
  sessionStorage.setItem(chave, divergente);
  await act(async () =>
    finalizar?.({
      data: {
        requestId: pedido.requestId,
        planoId: pedido.planoId, revisao: pedido.revisao, vigencia: pedido.vigencia, fotografiaRegistrada: true,
        fontesCompletasComprovadas: false,
        provaTransacionalIntegral: false,
        aprovacaoAutorizada: false,
        versaoAlterada: false,
        osAlteradas: false,
      },
      error: null,
    }),
  );
  expect(sessionStorage.getItem(chave)).toBe(divergente);
});

it("oculta histórico durante nova verificação e após acesso negado", async () => {
  let finalizar: ((v: { data: null; error: { code: string } }) => void) | undefined;
  api.rpc
    .mockReturnValueOnce({
      abortSignal: () =>
        Promise.resolve({
          data: [
            {
              request_id: "16630000-1111-4000-8000-000000000001",
              revisao_plano: 1,
              vigencia: "2026-11-01",
              ator_id: "16630000-1111-4000-8000-000000000002",
              criado_em: "2026-10-30T00:00:00Z",
              aprovacao_autorizada: false,
            },
          ],
          error: null,
        }),
    })
    .mockReturnValueOnce({
      abortSignal: () =>
        new Promise((resolve) => {
          finalizar = resolve;
        }),
    });
  vi.stubEnv("VITE_SSO_PRECONDICAO_IMPACTO_MEDIADA_ENABLED", "true");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PrecondicaoImpactos userId="u" clienteId="c" planoId="p" revisao={1} vigencia="2026-11-01" />
    </QueryClientProvider>,
  );
  await screen.findByText(/16630000-1111-4000-8000-000000000002/);
  void client.refetchQueries({ queryKey: ["precondicoes-impactos"] });
  await waitFor(() => expect(finalizar).toBeDefined());
  expect(screen.queryByText(/16630000-1111-4000-8000-000000000002/)).toBeNull();
  await act(async () => finalizar?.({ data: null, error: { code: "42501" } }));
  await screen.findByRole("alert");
  expect(screen.queryByText(/16630000-1111-4000-8000-000000000002/)).toBeNull();
});

it("libera nova conferência quando primeira tentativa encontra revisão obsoleta", async () => {
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_listar_precondicoes_impacto_mediada"
      ? { abortSignal: () => Promise.resolve({ data: [], error: null }) }
      : Promise.resolve({ data: null, error: { code: "P0011", message: "revisao_obsoleta" } }),
  );
  montar();
  fireEvent.click(screen.getByLabelText(/Confirmo apenas registrar/));
  fireEvent.click(screen.getByRole("button", { name: "Registrar fotografia" }));
  await screen.findByText(/A revisão mudou/);
  expect(sessionStorage.getItem(chave)).toBeNull();
});
it("preserva tentativa incerta e erro real de serialização", async () => {
  let n = 0;
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_listar_precondicoes_impacto_mediada"
      ? { abortSignal: () => Promise.resolve({ data: [], error: null }) }
      : Promise.resolve({
          data: null,
          error: ++n === 1 ? { code: "40001" } : { code: "P0011", message: "revisao_obsoleta" },
        }),
  );
  montar();
  fireEvent.click(screen.getByLabelText(/Confirmo apenas registrar/));
  fireEvent.click(screen.getByRole("button", { name: "Registrar fotografia" }));
  await screen.findByText(/Resultado não confirmado/);
  const salvo = sessionStorage.getItem(chave);
  expect(salvo).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(n).toBe(2));
  expect(sessionStorage.getItem(chave)).toBe(salvo);
});


it.each([
  ["planoId", "outro-plano"],
  ["revisao", 2],
  ["vigencia", "2026-11-02"],
  ["fotografiaRegistrada", false],
])("preserva o pedido quando o recibo diverge em %s e repete o mesmo pedido", async (campo, valor) => {
  let chamadas = 0;
  const parametros: unknown[] = [];
  api.rpc.mockImplementation((nome: string, args: Record<string, unknown>) => {
    if (nome === "sso_listar_precondicoes_impacto_mediada")
      return { abortSignal: () => Promise.resolve({ data: [], error: null }) };
    parametros.push(args);
    const recibo = {
      requestId: args.p_request_id, planoId: args.p_plano_id, revisao: args.p_expected_revision,
      vigencia: args.p_vigencia, fotografiaRegistrada: true, fontesCompletasComprovadas: false,
      provaTransacionalIntegral: false, aprovacaoAutorizada: false, versaoAlterada: false, osAlteradas: false,
    };
    return Promise.resolve({ data: ++chamadas === 1 ? { ...recibo, [campo]: valor } : recibo, error: null });
  });
  montar();
  fireEvent.click(screen.getByLabelText(/Confirmo apenas registrar/));
  fireEvent.click(screen.getByRole("button", { name: "Registrar fotografia" }));
  await screen.findByText(/Resultado não confirmado/);
  const salvo = sessionStorage.getItem(chave);
  expect(salvo).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
  expect(parametros).toHaveLength(2);
  expect(parametros[1]).toEqual(parametros[0]);
});
