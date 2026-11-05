// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    schema: api.schema,
    auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) },
  },
}));
import { TriagemCicloAtrasado } from "./TriagemCicloAtrasado";
const cliente = "00000000-0000-4000-8000-000000000001";
const plano = "00000000-0000-4000-8000-000000000002";
const rotina = "00000000-0000-4000-8000-000000000003";
const preparada = "00000000-0000-4000-8000-000000000004";
const versao = "00000000-0000-4000-8000-000000000005";
const chave = `sso-triagem-atraso:${JSON.stringify(["u", cliente, plano, rotina])}`;
const candidato = {
  preparada_id: preparada,
  versao_id: versao,
  rotina_id: rotina,
  ciclo: 1,
  vencimento_original: "2026-10-01",
  tolerancia_depois: 0,
  tem_vinculo_legado: false,
  tem_os: false,
  ultima_revisao: 0,
};
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});
function iniciar() {
  api.schema.mockReturnValue({ rpc: api.rpc });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = (userId = "u") => (
    <QueryClientProvider client={client}>
      <TriagemCicloAtrasado userId={userId} clienteId={cliente} planoId={plano} rotinaId={rotina} />
    </QueryClientProvider>
  );
  return { client, ...render(view()), view };
}
async function preencher() {
  fireEvent.change(screen.getByLabelText("Data de referência declarada"), {
    target: { value: "2026-10-30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Consultar candidatos" }));
  await screen.findByRole("option", { name: /Ciclo 1/ });
  fireEvent.change(screen.getByLabelText("Candidato"), { target: { value: preparada } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox"));
}
function configurar(resposta: (p: Record<string, unknown>) => Promise<unknown>) {
  api.rpc.mockImplementation((nome, p) =>
    nome === "sso_listar_candidatos_atraso"
      ? { abortSignal: () => Promise.resolve({ data: [candidato], error: null }) }
      : resposta(p),
  );
}
it("exige reconferência quando muda a decisão após confirmação", async () => {
  configurar(() => Promise.resolve({ data: null, error: null }));
  iniciar();
  await preencher();
  fireEvent.change(screen.getByLabelText("Decisão preliminar"), {
    target: { value: "tratar_manualmente" },
  });
  expect(
    (screen.getByRole("button", { name: "Registrar triagem" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
it("não remove tentativa substituída enquanto triagem é processada", async () => {
  let resolver!: (v: unknown) => void;
  configurar(
    () =>
      new Promise((r) => {
        resolver = r;
      }),
  );
  iniciar();
  await preencher();
  fireEvent.click(screen.getByRole("button", { name: "Registrar triagem" }));
  await waitFor(() =>
    expect(api.rpc).toHaveBeenCalledWith("sso_triar_ciclo_atrasado", expect.anything()),
  );
  const chamada = api.rpc.mock.calls.find(([n]) => n === "sso_triar_ciclo_atrasado");
  if (!chamada) throw new Error("Chamada ausente");
  const p = chamada[1];
  sessionStorage.setItem(chave, "outra tentativa");
  resolver({
    data: {
      requestId: p.p_request_id,
      preparadaId: p.p_preparada_id,
      revisao: 1,
      dataReferencia: p.p_data_referencia,
      decisao: p.p_decisao,
      dataBaseAlterada: false,
      ocorrenciaCriada: false,
      osCriada: false,
      tarefaAuvoCriada: false,
    },
    error: null,
  });
  await screen.findByText(/tentativa.*alterada/i);
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});
it("não oferece tentativa anterior ao trocar usuário", () => {
  sessionStorage.setItem(
    chave,
    JSON.stringify({
      requestId: "00000000-0000-4000-8000-000000000006",
      clienteId: cliente,
      preparadaId: preparada,
      revisao: 0,
      data: "2026-10-30",
      decisao: "avaliar",
      motivo: "Conferido",
    }),
  );
  const { rerender, view } = iniciar();
  expect(screen.getByRole("button", { name: "Repetir tentativa pendente" })).toBeTruthy();
  rerender(view("outro"));
  expect(screen.queryByRole("button", { name: "Repetir tentativa pendente" })).toBeNull();
  expect(sessionStorage.getItem(chave)).not.toBeNull();
});
it("exige nova consulta quando data digitada difere da referência conferida", async () => {
  configurar(() => Promise.resolve({ data: null, error: null }));
  iniciar();
  await preencher();
  fireEvent.change(screen.getByLabelText("Data de referência declarada"), {
    target: { value: "2026-11-01" },
  });
  expect(
    (screen.getByRole("button", { name: "Registrar triagem" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
it("exige nova conferência após revisão do candidato mudar", async () => {
  configurar(() => Promise.resolve({ data: null, error: null }));
  const { client } = iniciar();
  await preencher();
  client.setQueryData(["triagem-atraso", "u", cliente, plano, rotina, "2026-10-30"], {
    pages: [[{ ...candidato, ultima_revisao: 1 }]],
    pageParams: [null],
  });
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Registrar triagem" }) as HTMLButtonElement).disabled,
    ).toBe(true),
  );
});
it("permite selecionar a ocorrência encaminhada somente após encontrá-la nos candidatos", async () => {
  configurar(() => Promise.resolve({ data: null, error: null }));
  api.schema.mockReturnValue({ rpc: api.rpc });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TriagemCicloAtrasado
        userId="u"
        clienteId={cliente}
        planoId={plano}
        rotinaId={rotina}
        ocorrenciaEmConferencia={preparada}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByText(/ocorrência encaminhada para conferência/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Selecionar ocorrência encaminhada" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Data de referência declarada"), {
    target: { value: "2026-10-30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Consultar candidatos" }));
  fireEvent.click(await screen.findByRole("button", { name: "Selecionar ocorrência encaminhada" }));
  expect((screen.getByLabelText("Candidato") as HTMLSelectElement).value).toBe(preparada);
  expect(
    (screen.getByRole("button", { name: "Registrar triagem" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
it("repete exatamente o pedido após falha de rede", async () => {
  let chamadas = 0;
  configurar((p) => {
    chamadas++;
    return chamadas === 1
      ? Promise.resolve({ data: null, error: new Error("rede") })
      : Promise.resolve({
          data: {
            requestId: p.p_request_id,
            preparadaId: p.p_preparada_id,
            revisao: 1,
            dataReferencia: p.p_data_referencia,
            decisao: p.p_decisao,
            dataBaseAlterada: false,
            ocorrenciaCriada: false,
            osCriada: false,
            tarefaAuvoCriada: false,
          },
          error: null,
        });
  });
  iniciar();
  await preencher();
  fireEvent.click(screen.getByRole("button", { name: "Registrar triagem" }));
  const repetir = await screen.findByRole("button", { name: "Repetir tentativa pendente" });
  await waitFor(() => expect((repetir as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(repetir);
  await waitFor(() =>
    expect(api.rpc.mock.calls.filter(([n]) => n === "sso_triar_ciclo_atrasado")).toHaveLength(2),
  );
  const tentativas = api.rpc.mock.calls.filter(([n]) => n === "sso_triar_ciclo_atrasado");
  const [primeira, segunda] = tentativas;
  if (!primeira || !segunda) throw new Error("Chamadas ausentes");
  expect(segunda[1]).toEqual(primeira[1]);
  await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
});
it("não confirma triagem quando resposta identifica outro candidato", async () => {
  configurar((p) =>
    Promise.resolve({
      data: {
        requestId: p.p_request_id,
        preparadaId: "outra",
        revisao: 1,
        dataReferencia: "2026-10-30",
        decisao: "avaliar",
        dataBaseAlterada: false,
        ocorrenciaCriada: false,
        osCriada: false,
        tarefaAuvoCriada: false,
      },
      error: null,
    }),
  );
  iniciar();
  await preencher();
  fireEvent.click(screen.getByRole("button", { name: "Registrar triagem" }));
  expect(await screen.findByText(/resultado não confirmado/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Repetir tentativa pendente" })).toBeTruthy();
});
