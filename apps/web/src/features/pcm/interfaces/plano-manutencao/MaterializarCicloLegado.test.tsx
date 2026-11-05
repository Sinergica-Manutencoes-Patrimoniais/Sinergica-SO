// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn(), schema: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
vi.mock("./diagnostico-revisao-sessao", () => ({
  conferirSessaoDiagnostico: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./FilaAposPreparacao", () => ({
  FilaAposPreparacao: ({ preparadaId }: { preparadaId: string }) => (
    <p>Fila do ciclo: {preparadaId}</p>
  ),
}));
import { MaterializarCicloLegado } from "./MaterializarCicloLegado";

const props = {
  userId: "u",
  clienteId: "c",
  planoId: "p",
  legadoId: "l",
  relacaoId: "r",
  revision: 1,
};
const item = {
  preparada_id: "preparada",
  versao_id: "v",
  rotina_id: "rotina",
  alvo_tipo: "sistema",
  alvo_id: "alvo",
  vencimento_original: "2026-11-01",
  legadas_mesma_data: 0,
};
const chave = `sso-materializar-ciclo-legado:${JSON.stringify(["u", "c", "p", "l"])}`;
const queryKey = ["ciclos-integracao-legado", "u", "c", "p", "l", "r"];
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});
function preparar() {
  let concluir!: (value: unknown) => void;
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_ciclos_legados_mediados"
      ? { abortSignal: () => Promise.resolve({ data: [item], error: null }) }
      : new Promise((resolve) => {
          concluir = resolve;
        }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = (userId = "u") => (
    <QueryClientProvider client={client}>
      <MaterializarCicloLegado {...props} userId={userId} />
    </QueryClientProvider>
  );
  const tela = render(view());
  return { client, tela, view, concluir: (value: unknown) => concluir(value) };
}
async function selecionar() {
  await screen.findByRole("option", { name: /2026-11-01/ });
  fireEvent.change(await screen.findByLabelText("Ocorrência preparada"), {
    target: { value: "preparada" },
  });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi o ciclo/i }));
}

it("não apaga tentativa substituída por outra instância durante envio", async () => {
  const { concluir } = preparar();
  await selecionar();
  fireEvent.click(screen.getByRole("button", { name: "Processar ciclo" }));
  await waitFor(() =>
    expect(api.rpc).toHaveBeenCalledWith("sso_materializar_legado_mediado", expect.anything()),
  );
  const chamada = api.rpc.mock.calls.find(([nome]) => nome === "sso_materializar_legado_mediado");
  if (!chamada) throw new Error("Pedido de materialização ausente");
  const pedido = chamada[1];
  sessionStorage.setItem(chave, "tentativa de outra instância");
  concluir({
    data: {
      requestId: pedido.p_request_id,
      preparadaId: pedido.p_preparada_id,
      cicloId: pedido.p_ciclo_id,
      osCriada: false,
      tarefaAuvoCriada: false,
      equivalenciaGeralComprovada: false,
      ocorrenciaLegadaCriada: true,
    },
    error: null,
  });
  await waitFor(() => expect(screen.getByText(/tentativa.*alterada/i)).toBeTruthy());
  expect(sessionStorage.getItem(chave)).toBe("tentativa de outra instância");
});

it("exige reconferência quando candidato selecionado muda após atualização", async () => {
  const { client } = preparar();
  await selecionar();
  client.setQueryData(queryKey, {
    pages: [[{ ...item, legadas_mesma_data: 2 }]],
    pageParams: [null],
  });
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Processar ciclo" }) as HTMLButtonElement).disabled,
    ).toBe(true),
  );
  expect(
    api.rpc.mock.calls.filter(([nome]) => nome === "sso_materializar_legado_mediado"),
  ).toHaveLength(0);
});

it("não carrega tentativa anterior ao trocar usuário", () => {
  sessionStorage.setItem(
    chave,
    JSON.stringify({
      requestId: "req",
      ...props,
      preparadaId: "preparada",
      cicloId: "ciclo",
      motivo: "Conferido",
    }),
  );
  const { tela, view } = preparar();
  expect(screen.getByRole("button", { name: "Repetir tentativa pendente" })).toBeTruthy();
  tela.rerender(view("outro"));
  expect(screen.queryByRole("button", { name: "Repetir tentativa pendente" })).toBeNull();
  expect(sessionStorage.getItem(chave)).not.toBeNull();
});

it("não sobrescreve tentativa gravada por outra instância antes de enviar", async () => {
  preparar();
  await selecionar();
  sessionStorage.setItem(chave, "outra tentativa");
  fireEvent.click(screen.getByRole("button", { name: "Processar ciclo" }));
  expect(screen.getByText(/tentativa.*alterada/i)).toBeTruthy();
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
  expect(
    api.rpc.mock.calls.filter(([nome]) => nome === "sso_materializar_legado_mediado"),
  ).toHaveLength(0);
});

it("permite reconfirmar candidato atualizado antes de enviar", async () => {
  const { client } = preparar();
  await selecionar();
  client.setQueryData(queryKey, {
    pages: [[{ ...item, legadas_mesma_data: 2 }]],
    pageParams: [null],
  });
  await screen.findByText(/ciclo alterado ou indisponível/i);
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi o ciclo/i }));
  expect(
    (screen.getByRole("button", { name: "Processar ciclo" }) as HTMLButtonElement).disabled,
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Processar ciclo" }));
  await waitFor(() =>
    expect(api.rpc).toHaveBeenCalledWith(
      "sso_materializar_legado_mediado",
      expect.objectContaining({ p_ator_id: "u", p_preparada_id: "preparada" }),
    ),
  );
});

it("encaminha ciclo integrado para conferência independente da fila", async () => {
  const { concluir } = preparar();
  await selecionar();
  fireEvent.click(screen.getByRole("button", { name: "Processar ciclo" }));
  await waitFor(() =>
    expect(api.rpc).toHaveBeenCalledWith("sso_materializar_legado_mediado", expect.anything()),
  );
  const chamada = api.rpc.mock.calls.find(([nome]) => nome === "sso_materializar_legado_mediado");
  if (!chamada) throw new Error("Pedido de materialização ausente");
  const pedido = chamada[1];
  concluir({
    data: {
      requestId: pedido.p_request_id,
      preparadaId: pedido.p_preparada_id,
      cicloId: pedido.p_ciclo_id,
      osCriada: false,
      tarefaAuvoCriada: false,
      equivalenciaGeralComprovada: false,
      ocorrenciaLegadaCriada: true,
    },
    error: null,
  });
  expect(await screen.findByText("Fila do ciclo: preparada")).toBeInTheDocument();
});

it("pré-seleciona ciclo contextual e exige confirmação antes de integrar", async () => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_ciclos_legados_mediados"
      ? { abortSignal: () => Promise.resolve({ data: [item], error: null }) }
      : Promise.resolve({ data: null, error: null }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MaterializarCicloLegado {...props} preparadaInicial="preparada" />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: /2026-11-01/ });
  expect(screen.getByLabelText("Ocorrência preparada")).toHaveValue("preparada");
  expect(screen.getByRole("button", { name: "Processar ciclo" })).toBeDisabled();
  expect(
    api.rpc.mock.calls.filter(([nome]) => nome === "sso_materializar_legado_mediado"),
  ).toHaveLength(0);
});
