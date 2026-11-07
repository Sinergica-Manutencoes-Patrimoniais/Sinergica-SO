// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Recepcao } from "./Recepcao";

beforeEach(() => {
  sessionStorage.clear();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("recebe entrada manual sem exigir origem declarada", async () => {
  const receber = vi.fn().mockResolvedValue({});
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Recepcao userId="usuario" clienteId="cliente" receber={receber} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Identificação da origem"), {
    target: { value: "manual-1" },
  });
  fireEvent.change(screen.getByLabelText("Chave da linha"), { target: { value: "linha-1" } });
  fireEvent.change(screen.getByLabelText("Nome encontrado"), { target: { value: "Sistema" } });
  fireEvent.click(screen.getByRole("button", { name: "Receber para conferência" }));
  await waitFor(() => expect(receber).toHaveBeenCalledTimes(1));
  expect(receber.mock.calls[0]?.[1].origem).toBeNull();
});
it("preserva pedido incerto e repete exatamente o mesmo requestId", async () => {
  const receber = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({});
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Recepcao userId="usuario" clienteId="cliente" receber={receber} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Origem declarada"), { target: { value: "campo" } });
  fireEvent.change(screen.getByLabelText("Identificação da origem"), {
    target: { value: "origem-1" },
  });
  fireEvent.change(screen.getByLabelText("Chave da linha"), { target: { value: "linha-1" } });
  fireEvent.change(screen.getByLabelText("Nome encontrado"), {
    target: { value: "Sistema provisório" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Receber para conferência" }));
  await screen.findByRole("alert");
  expect(receber).toHaveBeenCalledTimes(1);
  const original = receber.mock.calls[0];
  fireEvent.click(screen.getByRole("button", { name: "Repetir recepção pendente" }));
  await waitFor(() => expect(receber).toHaveBeenCalledTimes(2));
  expect(receber.mock.calls[1]).toEqual(original);
  expect(
    await screen.findByText(
      "Levantamento recebido para conferência. Nenhum cadastro foi incorporado.",
    ),
  ).toBeTruthy();
});

it("não envia pedido quando armazenamento falha", async () => {
  const receber = vi.fn();
  const falha = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("indisponível");
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Recepcao userId="usuario" clienteId="cliente" receber={receber} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Origem declarada"), { target: { value: "campo" } });
  fireEvent.change(screen.getByLabelText("Identificação da origem"), {
    target: { value: "origem-1" },
  });
  fireEvent.change(screen.getByLabelText("Chave da linha"), { target: { value: "linha-1" } });
  fireEvent.change(screen.getByLabelText("Nome encontrado"), { target: { value: "Sistema" } });
  fireEvent.click(screen.getByRole("button", { name: "Receber para conferência" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível preparar o levantamento");
  expect(receber).not.toHaveBeenCalled();
  falha.mockRestore();
});

it("preserva pedido quando erro de validação não comprova ausência de recepção", async () => {
  const receber = vi.fn().mockRejectedValueOnce({ code: "22023" });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Recepcao userId="usuario" clienteId="cliente" receber={receber} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Origem declarada"), { target: { value: "campo" } });
  fireEvent.change(screen.getByLabelText("Identificação da origem"), {
    target: { value: "origem-1" },
  });
  fireEvent.change(screen.getByLabelText("Chave da linha"), { target: { value: "linha-1" } });
  fireEvent.change(screen.getByLabelText("Nome encontrado"), { target: { value: "Sistema" } });
  fireEvent.click(screen.getByRole("button", { name: "Receber para conferência" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Recepção não confirmada");
  expect(screen.getByRole("button", { name: "Repetir recepção pendente" })).toBeInTheDocument();
  expect(receber).toHaveBeenCalledTimes(1);
});
