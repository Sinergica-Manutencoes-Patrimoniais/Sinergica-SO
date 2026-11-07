// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ ler: vi.fn(), salvar: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "user-a" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-esforco-declarado-adapter", () => ({
  consultarEsforcoDeclarado: api.ler,
  declararEsforco: api.salvar,
}));
import { EsforcoDeclarado } from "./EsforcoDeclarado";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

it("salva ocorrência de calendário com identidade e tentativa separadas da OS", async () => {
  api.ler.mockResolvedValue({ origemTipo: "ocorrencia", origemId: "mesmo-id", revision: 0, internosMinutos: null, terceirosMinutos: null, acompanhamentoMinutos: null });
  api.salvar.mockRejectedValueOnce(new Error("rede"));
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
  const chaveOs = `sso-esforco:${JSON.stringify(["user-a", "cliente-a", "mesmo-id"])}`;
  sessionStorage.setItem(chaveOs, "outra operação");
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><EsforcoDeclarado userId="user-a" clienteId="cliente-a" osId="mesmo-id" origemTipo="ocorrencia" /></QueryClientProvider>);
  fireEvent.change(await screen.findByLabelText("Justificativa"), { target: { value: "Estimativa" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar declaração" }));
  await screen.findByRole("alert");
  expect(api.ler).toHaveBeenCalledWith("cliente-a", "mesmo-id", expect.any(AbortSignal), "ocorrencia");
  expect(api.salvar).toHaveBeenCalledWith(expect.objectContaining({ origemTipo: "ocorrencia", origemId: "mesmo-id", clienteId: "cliente-a" }));
  expect(sessionStorage.getItem(chaveOs)).toBe("outra operação");
  expect(sessionStorage.getItem(`sso-esforco-ocorrencia:${JSON.stringify(["user-a", "cliente-a", "mesmo-id"])}`)).toBeTruthy();
});

it("salva ocorrência por Visita com tipo e requestId próprios", async () => {
  api.ler.mockResolvedValue({ origemTipo: "ocorrencia_visita", origemId: "visita-a", revision: 2, internosMinutos: null, terceirosMinutos: null, acompanhamentoMinutos: null });
  api.salvar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce(undefined);
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><EsforcoDeclarado userId="user-a" clienteId="cliente-a" osId="visita-a" origemTipo="ocorrencia_visita" /></QueryClientProvider>);
  fireEvent.change(await screen.findByLabelText("Justificativa"), { target: { value: "Estimativa" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar declaração" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(api.salvar).toHaveBeenCalledTimes(2));
  expect(api.salvar.mock.calls[0]?.[0]).toMatchObject({ origemTipo: "ocorrencia_visita", origemId: "visita-a", revision: 2 });
  expect(api.salvar.mock.calls[1]?.[0]).toEqual(api.salvar.mock.calls[0]?.[0]);
});

it("recupera tentativa após recarga e repete a revisão original mesmo se leitura avançou", async () => {
  api.ler.mockResolvedValue({
    origemTipo: "os",
    origemId: "os-a",
    revision: 0,
    internosMinutos: null,
    terceirosMinutos: null,
    acompanhamentoMinutos: null,
  });
  api.salvar.mockRejectedValueOnce(new Error("resultado incerto")).mockResolvedValueOnce(undefined);
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
  const montar = () =>
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <EsforcoDeclarado userId="user-a" clienteId="cliente-a" osId="os-a" />
      </QueryClientProvider>,
    );
  const primeira = montar();
  fireEvent.change(await screen.findByLabelText("Terceiros (minutos-homem)"), {
    target: { value: "120" },
  });
  fireEvent.change(screen.getByLabelText("Justificativa"), { target: { value: "Estimativa" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar declaração" }));
  await screen.findByRole("alert");
  primeira.unmount();
  api.ler.mockResolvedValue({
    origemTipo: "os",
    origemId: "os-a",
    revision: 1,
    internosMinutos: null,
    terceirosMinutos: 120,
    acompanhamentoMinutos: null,
  });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(api.salvar).toHaveBeenCalledTimes(2));
  expect(api.salvar.mock.calls[1]?.[0]).toEqual(api.salvar.mock.calls[0]?.[0]);
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
});

it("não substitui tentativa divergente nem envia novamente", async () => {
  api.ler.mockResolvedValue({
    origemTipo: "os",
    origemId: "os-a",
    revision: 0,
    internosMinutos: null,
    terceirosMinutos: null,
    acompanhamentoMinutos: null,
  });
  api.salvar.mockRejectedValueOnce(new Error("resultado incerto"));
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EsforcoDeclarado userId="user-a" clienteId="cliente-a" osId="os-a" />
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByLabelText("Justificativa"), {
    target: { value: "Cadastro" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar declaração" }));
  await screen.findByRole("alert");
  const chave = `sso-esforco:${JSON.stringify(["user-a", "cliente-a", "os-a"])}`;
  sessionStorage.setItem(chave, "outra tentativa");
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  expect(api.salvar).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});

it("não apaga tentativa que mudou enquanto a confirmação estava em trânsito", async () => {
  api.ler.mockResolvedValue({
    origemTipo: "os",
    origemId: "os-a",
    revision: 0,
    internosMinutos: null,
    terceirosMinutos: null,
    acompanhamentoMinutos: null,
  });
  let confirmar!: () => void;
  api.salvar.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        confirmar = resolve;
      }),
  );
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EsforcoDeclarado userId="user-a" clienteId="cliente-a" osId="os-a" />
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByLabelText("Justificativa"), {
    target: { value: "Cadastro" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar declaração" }));
  await waitFor(() => expect(api.salvar).toHaveBeenCalledTimes(1));
  const chave = `sso-esforco:${JSON.stringify(["user-a", "cliente-a", "os-a"])}`;
  sessionStorage.setItem(chave, "outra tentativa");
  confirmar();
  await screen.findByRole("alert");
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});

it("declara terceiros e acompanhamento sem preencher HH próprio ausente", async () => {
  api.ler.mockResolvedValue({
    origemTipo: "os",
    origemId: "os-a",
    revision: 0,
    internosMinutos: null,
    terceirosMinutos: null,
    acompanhamentoMinutos: null,
  });
  api.salvar.mockResolvedValue({ revision: 1 });
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EsforcoDeclarado userId="user-a" clienteId="cliente-a" osId="os-a" />
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByLabelText("Terceiros (minutos-homem)"), {
    target: { value: "120" },
  });
  fireEvent.change(screen.getByLabelText("Acompanhamento interno (minutos-homem)"), {
    target: { value: "30" },
  });
  fireEvent.change(screen.getByLabelText("Justificativa"), {
    target: { value: "Estimativa declarada" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar declaração" }));
  await waitFor(() =>
    expect(api.salvar).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: "cliente-a",
        origemId: "os-a",
        revision: 0,
        internosMinutos: null,
        terceirosMinutos: 120,
        acompanhamentoMinutos: 30,
      }),
    ),
  );
});

it("repete mesmo requestId após falha, sem perder dados declarados", async () => {
  api.ler.mockResolvedValue({
    origemTipo: "os",
    origemId: "os-a",
    revision: 0,
    internosMinutos: null,
    terceirosMinutos: null,
    acompanhamentoMinutos: null,
  });
  api.salvar.mockRejectedValueOnce(new Error("conexão incerta")).mockResolvedValueOnce(undefined);
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EsforcoDeclarado userId="user-a" clienteId="cliente-a" osId="os-a" />
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByLabelText("Justificativa"), {
    target: { value: "Cadastro" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar declaração" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(api.salvar).toHaveBeenCalledTimes(2));
  expect(api.salvar.mock.calls[0]?.[0].requestId).toBe(api.salvar.mock.calls[1]?.[0].requestId);
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
});
