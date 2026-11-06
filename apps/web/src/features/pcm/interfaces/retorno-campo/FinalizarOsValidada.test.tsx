// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: api.schema, auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
import { FinalizarOsValidada } from "./FinalizarOsValidada";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  sessionStorage.clear();
});
it("exige nova confirmação quando o estado consultado da OS muda", async () => {
  const previa = { osId: "16800000-0000-4000-8000-000000000004", status: "em_execucao", updatedAt: "2026-10-01T10:00:00Z", chamadoAlterado: false, notificacaoLegadaPossivel: true };
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: previa, error: null }) });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <FinalizarOsValidada
        userId="u"
        clienteId="c"
        retornoId="r"
        atestacaoId="a"
        decisaoRevision={3}
      />
    </QueryClientProvider>,
  );
  const marcar = await screen.findByRole("checkbox");
  await screen.findByText(/OS 16800000/);
  fireEvent.click(marcar);
  expect(
    (screen.getByRole("button", { name: "Finalizar OS individual" }) as HTMLButtonElement).disabled,
  ).toBe(false);
  client.setQueryData(["retorno-previa-finalizacao-os", "u", "c", "r"], {
    ...previa,
    updatedAt: "2026-10-01T11:00:00Z",
  });
  await screen.findByText(/2026-10-01T11:00:00Z/);
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  expect(
    (screen.getByRole("button", { name: "Finalizar OS individual" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(
    api.rpc.mock.calls.some(
      ([nome]) =>
        nome.startsWith("sso_finalizar_os_validada") || nome === "sso_mediar_finalizacao_os",
    ),
  ).toBe(false);
});

it("não confirma resposta de outro retorno e mantém tentativa idêntica", async () => {
  const requestId = "16800000-0000-4000-8000-000000000003";
  const retornoId = "16800000-0000-4000-8000-000000000002";
  const osId = "16800000-0000-4000-8000-000000000004";
  const previa = { osId, status: "em_execucao", updatedAt: "2026-10-01T10:00:00Z", chamadoAlterado: false, notificacaoLegadaPossivel: true };
  const retorno = { requestId, retornoId, osId, status: "finalizado", chamadoAlterado: false };
  vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId);
  api.schema.mockReturnValue({ rpc: api.rpc });
  let resposta = { ...retorno, retornoId: osId };
  api.rpc.mockImplementation((nome) =>
    nome === "sso_mediar_previa_finalizacao_os"
      ? { abortSignal: () => Promise.resolve({ data: previa, error: null }) }
      : Promise.resolve({ data: resposta, error: null }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <FinalizarOsValidada
        userId="u"
        clienteId="c"
        retornoId={retornoId}
        atestacaoId="a"
        decisaoRevision={3}
      />
    </QueryClientProvider>,
  );
  await screen.findByText(/OS 16800000/);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Finalizar OS individual" }));
  expect(await screen.findByText(/resultado não confirmado/i)).toBeTruthy();
  resposta = { ...retorno, osId: retornoId };
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await screen.findByText(/resultado não confirmado/i);
  expect(screen.getByRole("button", { name: "Repetir tentativa pendente" })).toBeTruthy();
  resposta = retorno;
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  expect(await screen.findByText(/OS finalizada no legado/i)).toBeTruthy();
  const pedidos = api.rpc.mock.calls.filter(([nome]) => nome === "sso_mediar_finalizacao_os");
  expect(pedidos).toHaveLength(3);
  expect(pedidos[0]?.[1].p_expected_os_id).toBe(osId);
  for (const pedido of pedidos) expect(pedido[1]).toEqual(pedidos[0]?.[1]);
});

it("preserva tentativa antiga sem osId e bloqueia nova escrita até reconciliação", async () => {
  const retornoId = "16800000-0000-4000-8000-000000000002";
  const atestacaoId = "16800000-0000-4000-8000-000000000005";
  const pedido = {
    requestId: "16800000-0000-4000-8000-000000000003",
    clienteId: "c",
    retornoId,
    atestacaoId,
    decisaoRevision: 3,
    status: "em_execucao",
    updatedAt: "2026-10-01T10:00:00Z",
  };
  const chave = `sso-finalizacao-os:${JSON.stringify(["u", "c", retornoId, atestacaoId])}`;
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        data: {
          osId: "16800000-0000-4000-8000-000000000004",
          status: "em_execucao",
          updatedAt: pedido.updatedAt,
        },
        error: null,
      }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FinalizarOsValidada
        userId="u"
        clienteId="c"
        retornoId={retornoId}
        atestacaoId={atestacaoId}
        decisaoRevision={3}
      />
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/tentativa antiga.*reconciliação/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Repetir tentativa pendente" })).toBeNull();
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
  expect(
    api.rpc.mock.calls.some(
      ([nome]) =>
        nome.startsWith("sso_finalizar_os_validada") || nome === "sso_mediar_finalizacao_os",
    ),
  ).toBe(false);
  api.rpc.mockImplementation((nome) =>
    nome === "sso_mediar_previa_finalizacao_os"
      ? {
          abortSignal: () =>
            Promise.resolve({
              data: {
                osId: "16800000-0000-4000-8000-000000000004",
                status: "em_execucao",
                updatedAt: pedido.updatedAt,
              },
              error: null,
            }),
        }
      : Promise.resolve({
          data: { situacao: "nao_localizada", requestId: pedido.requestId },
          error: null,
        }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Consultar resultado anterior" }));
  expect(await screen.findByText(/não localizada.*não autoriza/i)).toBeTruthy();
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
  expect(
    api.rpc.mock.calls.some(
      ([nome]) =>
        nome.startsWith("sso_finalizar_os_validada") || nome === "sso_mediar_finalizacao_os",
    ),
  ).toBe(false);
  api.rpc.mockImplementation((nome) =>
    nome === "sso_mediar_previa_finalizacao_os"
      ? {
          abortSignal: () =>
            Promise.resolve({
              data: {
                osId: "16800000-0000-4000-8000-000000000004",
                status: "em_execucao",
                updatedAt: pedido.updatedAt,
              },
              error: null,
            }),
        }
      : Promise.resolve({
          data: {
            situacao: "encontrada",
            requestId: pedido.requestId,
            resultado: {
              requestId: pedido.requestId,
              retornoId,
              osId: "16800000-0000-4000-8000-000000000004",
              status: "finalizado",
              chamadoAlterado: false,
            },
          },
          error: null,
        }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Consultar resultado anterior" }));
  expect(await screen.findByText(/resultado anterior confirmado/i)).toBeTruthy();
  expect(sessionStorage.getItem(chave)).toBeNull();
  expect(
    api.rpc.mock.calls.some(
      ([nome]) =>
        nome.startsWith("sso_finalizar_os_validada") || nome === "sso_mediar_finalizacao_os",
    ),
  ).toBe(false);
});

it("não remove tentativa local substituída enquanto operação estava em voo", async () => {
  const requestId = "16800000-0000-4000-8000-000000000003";
  const retornoId = "16800000-0000-4000-8000-000000000002";
  const osId = "16800000-0000-4000-8000-000000000004";
  const atestacaoId = "16800000-0000-4000-8000-000000000005";
  const chave = `sso-finalizacao-os:${JSON.stringify(["u", "c", retornoId, atestacaoId])}`;
  vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId);
  api.schema.mockReturnValue({ rpc: api.rpc });
  let resolver!: (valor: unknown) => void;
  api.rpc.mockImplementation((nome) =>
    nome === "sso_mediar_previa_finalizacao_os"
      ? {
          abortSignal: () =>
            Promise.resolve({
              data: { osId, status: "em_execucao", updatedAt: "2026-10-01T10:00:00Z", chamadoAlterado: false, notificacaoLegadaPossivel: true },
              error: null,
            }),
        }
      : new Promise((resolve) => {
          resolver = resolve;
        }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <FinalizarOsValidada
        userId="u"
        clienteId="c"
        retornoId={retornoId}
        atestacaoId={atestacaoId}
        decisaoRevision={3}
      />
    </QueryClientProvider>,
  );
  await screen.findByText(/OS 16800000/);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Finalizar OS individual" }));
  await waitFor(() => expect(resolver).toBeTypeOf("function"));
  sessionStorage.setItem(chave, "outra tentativa");
  resolver({
    data: { requestId, retornoId, osId, status: "finalizado", chamadoAlterado: false },
    error: null,
  });
  expect(await screen.findByText(/tentativa local não pôde ser removida/i)).toBeTruthy();
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});
