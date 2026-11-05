// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    schema: api.schema,
    auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) },
  },
}));
import { GerarVisitaContratual } from "./GerarVisitaContratual";
function exigir<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error("Valor esperado ausente");
  return valor;
}
beforeEach(() => {
  vi.stubEnv("VITE_SSO_GERACAO_OU_SUPRESSAO_ENABLED", "true");
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

it("consulta regras reais pela fronteira mediada autorizada", async () => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        data: [
          {
            id: "regra",
            numero: 1,
            ancora_semana: "2026-10-05",
            dia_semana: 5,
            intervalo_semanas: 1,
            hora_inicio: "09:00",
            fuso: "America/Sao_Paulo",
            vigencia_inicio: "2026-01-01",
            vigencia_fim: null,
          },
        ],
        error: null,
      }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <GerarVisitaContratual userId="u" clienteId="c" serieId="s" />
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/Regra 1/)).toBeTruthy();
  await waitFor(() =>
    expect(api.rpc).toHaveBeenCalledWith("sso_pcm_listar_regras_visita", {
      p_cliente_id: "c",
      p_serie_id: "s",
      p_apos: 0,
      p_limite: 20,
    }),
  );
});

it("envia semana e origem à fronteira mediada sem tarefa externa", async () => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockImplementation((nome, p) =>
    nome === "sso_pcm_listar_regras_visita"
      ? {
          abortSignal: () =>
            Promise.resolve({
              data: [
                {
                  id: "regra",
                  numero: 1,
                  ancora_semana: "2026-10-05",
                  dia_semana: 5,
                  intervalo_semanas: 1,
                  hora_inicio: "09:00",
                  fuso: "America/Sao_Paulo",
                  vigencia_inicio: "2026-01-01",
                  vigencia_fim: null,
                },
              ],
              error: null,
            }),
        }
      : Promise.resolve({
          data: {
            requestId: p.p_request_id,
            clienteId: p.p_cliente_id,
            serieId: p.p_serie_id,
            semana: p.p_semana,
            efeitoRemoto: false,
            decisao: "gerada",
            detalhe: {
              requestId: p.p_request_id,
              decisao: "criada",
              visitaCriada: true,
              visitaId: p.p_visita_id,
            },
          },
          error: null,
        }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <GerarVisitaContratual userId="u" clienteId="c" serieId="s" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Regra 1/);
  fireEvent.change(screen.getByLabelText("Regra"), { target: { value: "regra" } });
  fireEvent.change(screen.getByLabelText("Segunda-feira da semana"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText(/Início com offset explícito/), {
    target: { value: "2026-10-09T09:00:00-03:00" },
  });
  fireEvent.change(screen.getByLabelText("Fonte e cobertura dos feriados conferidos"), {
    target: { value: "Calendário consultado" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Processar semana" }));
  expect(await screen.findByText(/Visita regular em rascunho criada/)).toBeTruthy();
  expect(exigir(api.rpc.mock.calls[1])[0]).toBe("sso_gerar_visita_ou_suprimir");
  expect(exigir(api.rpc.mock.calls[1])[1]).toMatchObject({
    p_cliente_id: "c",
    p_serie_id: "s",
    p_regra_id: "regra",
    p_semana: "2026-10-05",
    p_cobertura: "Calendário consultado",
  });
});

it("preserva tentativa substituída enquanto o servidor responde", async () => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  let concluir!: (v: unknown) => void;
  api.rpc.mockImplementation((nome) =>
    nome === "sso_pcm_listar_regras_visita"
      ? {
          abortSignal: () =>
            Promise.resolve({
              data: [
                {
                  id: "regra",
                  numero: 1,
                  ancora_semana: "2026-10-05",
                  dia_semana: 5,
                  intervalo_semanas: 1,
                  hora_inicio: "09:00",
                  fuso: "America/Sao_Paulo",
                  vigencia_inicio: "2026-01-01",
                  vigencia_fim: null,
                },
              ],
              error: null,
            }),
        }
      : new Promise((resolve) => {
          concluir = resolve;
        }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <GerarVisitaContratual userId="u" clienteId="c" serieId="s" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Regra 1/);
  fireEvent.change(screen.getByLabelText("Regra"), { target: { value: "regra" } });
  fireEvent.change(screen.getByLabelText("Segunda-feira da semana"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText(/Início com offset explícito/), {
    target: { value: "2026-10-09T09:00:00-03:00" },
  });
  fireEvent.change(screen.getByLabelText("Fonte e cobertura dos feriados conferidos"), {
    target: { value: "Calendário consultado" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Processar semana" }));
  await waitFor(() => expect(api.rpc).toHaveBeenCalledTimes(2));
  const requestId = exigir(api.rpc.mock.calls[1])[1].p_request_id;
  const chave = exigir(sessionStorage.key(0));
  sessionStorage.setItem(chave, "outra tentativa");
  concluir({
    data: {
      requestId,
      clienteId: "c",
      serieId: "s",
      semana: "2026-10-05",
      efeitoRemoto: false,
      decisao: "gerada",
      detalhe: {
        requestId,
        decisao: "criada",
        visitaCriada: true,
        visitaId: exigir(api.rpc.mock.calls[1])[1].p_visita_id,
      },
    },
    error: null,
  });
  await waitFor(() => expect(screen.getByText(/tentativa alterada ou não removida/i)).toBeTruthy());
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});

it("não oferece o pedido pendente de outro usuário quando a sessão muda", () => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [], error: null }) });
  const chave = `sso-gerar-visita-contratual:${JSON.stringify(["u", "c", "s"])}`;
  sessionStorage.setItem(
    chave,
    JSON.stringify({
      requestId: "req",
      clienteId: "c",
      serieId: "s",
      regraId: "r",
      semana: "2026-10-05",
      visitaId: "visita",
      inicio: "2026-10-09T09:00:00-03:00",
      cobertura: "fonte",
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { rerender } = render(
    <QueryClientProvider client={client}>
      <GerarVisitaContratual userId="u" clienteId="c" serieId="s" />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("button", { name: "Repetir tentativa pendente" })).toBeTruthy();
  rerender(
    <QueryClientProvider client={client}>
      <GerarVisitaContratual userId="outro" clienteId="c" serieId="s" />
    </QueryClientProvider>,
  );
  expect(screen.queryByRole("button", { name: "Repetir tentativa pendente" })).toBeNull();
  expect(sessionStorage.getItem(chave)).not.toBeNull();
});

it("exige nova confirmação quando semana muda após conferência", async () => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        data: [
          {
            id: "regra",
            numero: 1,
            ancora_semana: "2026-10-05",
            dia_semana: 5,
            intervalo_semanas: 1,
            hora_inicio: "09:00",
            fuso: "America/Sao_Paulo",
            vigencia_inicio: "2026-01-01",
            vigencia_fim: null,
          },
        ],
        error: null,
      }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <GerarVisitaContratual userId="u" clienteId="c" serieId="s" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Regra 1/);
  fireEvent.change(screen.getByLabelText("Regra"), { target: { value: "regra" } });
  fireEvent.change(screen.getByLabelText("Segunda-feira da semana"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText(/Início com offset explícito/), {
    target: { value: "2026-10-09T09:00:00-03:00" },
  });
  fireEvent.change(screen.getByLabelText("Fonte e cobertura dos feriados conferidos"), {
    target: { value: "Calendário consultado" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Segunda-feira da semana"), {
    target: { value: "2026-10-12" },
  });
  expect(
    (screen.getByRole("button", { name: "Processar semana" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
});

it("exige reconferência quando regra selecionada é atualizada", async () => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  const regra = {
    id: "regra",
    numero: 1,
    ancora_semana: "2026-10-05",
    dia_semana: 5,
    intervalo_semanas: 1,
    hora_inicio: "09:00",
    fuso: "America/Sao_Paulo",
    vigencia_inicio: "2026-01-01",
    vigencia_fim: null,
  };
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [regra], error: null }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <GerarVisitaContratual userId="u" clienteId="c" serieId="s" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Regra 1/);
  fireEvent.change(screen.getByLabelText("Regra"), { target: { value: "regra" } });
  fireEvent.change(screen.getByLabelText("Segunda-feira da semana"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText(/Início com offset explícito/), {
    target: { value: "2026-10-09T09:00:00-03:00" },
  });
  fireEvent.change(screen.getByLabelText("Fonte e cobertura dos feriados conferidos"), {
    target: { value: "Calendário consultado" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  client.setQueryData(["regras-geracao-visita", "u", "c", "s"], {
    pages: [[{ ...regra, hora_inicio: "10:00" }]],
    pageParams: [0],
  });
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Processar semana" }) as HTMLButtonElement).disabled,
    ).toBe(true),
  );
  expect(screen.getByText(/dados ou regra alterados/i)).toBeTruthy();
});

it("invalida lista de Visitas após criação confirmada", async () => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockImplementation((nome, p) =>
    nome === "sso_pcm_listar_regras_visita"
      ? {
          abortSignal: () =>
            Promise.resolve({
              data: [
                {
                  id: "regra",
                  numero: 1,
                  ancora_semana: "2026-10-05",
                  dia_semana: 5,
                  intervalo_semanas: 1,
                  hora_inicio: "09:00",
                  fuso: "America/Sao_Paulo",
                  vigencia_inicio: "2026-01-01",
                  vigencia_fim: null,
                },
              ],
              error: null,
            }),
        }
      : Promise.resolve({
          data: {
            requestId: p.p_request_id,
            clienteId: p.p_cliente_id,
            serieId: p.p_serie_id,
            semana: p.p_semana,
            efeitoRemoto: false,
            decisao: "gerada",
            detalhe: {
              requestId: p.p_request_id,
              decisao: "criada",
              visitaCriada: true,
              visitaId: p.p_visita_id,
            },
          },
          error: null,
        }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidar = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <GerarVisitaContratual userId="u" clienteId="c" serieId="s" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Regra 1/);
  fireEvent.change(screen.getByLabelText("Regra"), { target: { value: "regra" } });
  fireEvent.change(screen.getByLabelText("Segunda-feira da semana"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText(/Início com offset explícito/), {
    target: { value: "2026-10-09T09:00:00-03:00" },
  });
  fireEvent.change(screen.getByLabelText("Fonte e cobertura dos feriados conferidos"), {
    target: { value: "Calendário consultado" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Processar semana" }));
  await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ["visitas", "u", "c"] }));
});

it("não confirma criação quando servidor retorna identidade divergente", async () => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockImplementation((nome, p) =>
    nome === "sso_pcm_listar_regras_visita"
      ? {
          abortSignal: () =>
            Promise.resolve({
              data: [
                {
                  id: "regra",
                  numero: 1,
                  ancora_semana: "2026-10-05",
                  dia_semana: 5,
                  intervalo_semanas: 1,
                  hora_inicio: "09:00",
                  fuso: "America/Sao_Paulo",
                  vigencia_inicio: "2026-01-01",
                  vigencia_fim: null,
                },
              ],
              error: null,
            }),
        }
      : Promise.resolve({
          data: {
            requestId: p.p_request_id,
            clienteId: p.p_cliente_id,
            serieId: p.p_serie_id,
            semana: p.p_semana,
            efeitoRemoto: false,
            decisao: "gerada",
            detalhe: {
              requestId: p.p_request_id,
              decisao: "criada",
              visitaCriada: true,
              visitaId: "outra",
            },
          },
          error: null,
        }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <GerarVisitaContratual userId="u" clienteId="c" serieId="s" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Regra 1/);
  fireEvent.change(screen.getByLabelText("Regra"), { target: { value: "regra" } });
  fireEvent.change(screen.getByLabelText("Segunda-feira da semana"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText(/Início com offset explícito/), {
    target: { value: "2026-10-09T09:00:00-03:00" },
  });
  fireEvent.change(screen.getByLabelText("Fonte e cobertura dos feriados conferidos"), {
    target: { value: "Calendário consultado" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Processar semana" }));
  expect(await screen.findByText(/Resultado não confirmado/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Repetir tentativa pendente" })).toBeTruthy();
  expect(screen.queryByText(/Visita regular em rascunho criada/i)).toBeNull();
});

it("mostra supressão válida sem anunciar criação", async () => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockImplementation((nome, p) =>
    nome === "sso_pcm_listar_regras_visita"
      ? {
          abortSignal: () =>
            Promise.resolve({
              data: [
                {
                  id: "regra",
                  numero: 1,
                  ancora_semana: "2026-10-05",
                  dia_semana: 5,
                  intervalo_semanas: 1,
                  hora_inicio: "09:00",
                  fuso: "America/Sao_Paulo",
                  vigencia_inicio: "2026-01-01",
                  vigencia_fim: null,
                },
              ],
              error: null,
            }),
        }
      : Promise.resolve({
          data: {
            requestId: p.p_request_id,
            clienteId: p.p_cliente_id,
            serieId: p.p_serie_id,
            semana: p.p_semana,
            efeitoRemoto: false,
            decisao: "suprimida_feriado",
            detalhe: {
              requestId: p.p_request_id,
              visitaCriada: false,
              ocorrenciaCriada: false,
              osCriada: false,
              tarefaAuvoCriada: false,
            },
          },
          error: null,
        }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <GerarVisitaContratual userId="u" clienteId="c" serieId="s" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Regra 1/);
  fireEvent.change(screen.getByLabelText("Regra"), { target: { value: "regra" } });
  fireEvent.change(screen.getByLabelText("Segunda-feira da semana"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText(/Início com offset explícito/), {
    target: { value: "2026-10-09T09:00:00-03:00" },
  });
  fireEvent.change(screen.getByLabelText("Fonte e cobertura dos feriados conferidos"), {
    target: { value: "Calendário consultado" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Processar semana" }));
  expect(await screen.findByText(/Semana suprimida por feriado declarado/i)).toBeTruthy();
  expect(screen.queryByText(/Visita regular em rascunho criada/i)).toBeNull();
});
