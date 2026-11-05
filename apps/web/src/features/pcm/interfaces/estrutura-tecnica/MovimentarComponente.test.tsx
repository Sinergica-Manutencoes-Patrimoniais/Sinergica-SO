// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth } }));
import { MovimentarComponente } from "./MovimentarComponente";

const componenteId = "17690000-0000-4000-8000-000000000011";
const areaId = "17690000-0000-4000-8000-000000000021";
const chave = `sso-movimento:17690000-0000-4000-8000-000000000001:17690000-0000-4000-8000-000000000002:${componenteId}`;
const item = {
  id: componenteId,
  estruturaRevisao: 3,
  areaId: null,
  localId: null,
  parentItemId: null,
};

beforeEach(() => {
  auth.getUser.mockReset().mockResolvedValue({
    data: { user: { id: "17690000-0000-4000-8000-000000000001" } },
    error: null,
  });
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

it("preserva pedido após resposta incerta e recusas de replay, até confirmar o mesmo comando", async () => {
  const enviar = vi
    .fn()
    .mockRejectedValueOnce(new Error("conexão interrompida"))
    .mockRejectedValueOnce({ code: "40001" })
    .mockRejectedValueOnce({ code: "23514" })
    .mockImplementationOnce(async (comando) => ({
      requestId: comando.requestId,
      aggregateId: comando.componenteId,
      revision: comando.expectedRevision + 1,
      linkedIds: { clienteId: "17690000-0000-4000-8000-000000000002", areaId },
    }));
  const concluido = vi.fn();
  render(
    <MovimentarComponente
      userId="17690000-0000-4000-8000-000000000001"
      clienteId="17690000-0000-4000-8000-000000000002"
      item={item}
      areas={[{ id: areaId, nome: "Área A" }]}
      locais={[]}
      pais={[]}
      enviar={enviar}
      onConcluido={concluido}
    />,
  );
  fireEvent.change(screen.getByLabelText("Área de destino"), { target: { value: areaId } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar movimentação" }));
  await screen.findByRole("button", { name: "Tentar movimentação novamente" });
  const guardado = sessionStorage.getItem(chave);
  expect(guardado).not.toBeNull();
  const pedido = JSON.parse(guardado as string);
  expect(pedido).toEqual({
    requestId: expect.any(String),
    expectedRevision: 3,
    componenteId,
    areaId,
    localId: null,
    parentId: null,
  });
  for (const numero of [2, 3]) {
    fireEvent.click(screen.getByRole("button", { name: "Tentar movimentação novamente" }));
    await waitFor(() => expect(enviar).toHaveBeenCalledTimes(numero));
    await screen.findByRole("button", { name: "Tentar movimentação novamente" });
    expect(sessionStorage.getItem(chave)).toBe(guardado);
    expect(concluido).not.toHaveBeenCalled();
  }
  fireEvent.click(screen.getByRole("button", { name: "Tentar movimentação novamente" }));
  await waitFor(() => expect(concluido).toHaveBeenCalledTimes(1));
  expect(enviar).toHaveBeenCalledTimes(4);
  for (const [comando] of enviar.mock.calls) expect(comando).toEqual(pedido);
  expect(sessionStorage.getItem(chave)).toBeNull();
});

it("recibo divergente preserva o pedido para reconciliação", async () => {
  const enviar = vi.fn().mockImplementation(async (comando) => ({
    requestId: "17690000-0000-4000-8000-000000000099",
    aggregateId: comando.componenteId,
    revision: comando.expectedRevision + 1,
    linkedIds: { clienteId: "17690000-0000-4000-8000-000000000002" },
  }));
  const concluido = vi.fn();
  render(
    <MovimentarComponente
      userId="17690000-0000-4000-8000-000000000001"
      clienteId="17690000-0000-4000-8000-000000000002"
      item={item}
      areas={[]}
      locais={[]}
      pais={[]}
      enviar={enviar}
      onConcluido={concluido}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirmar movimentação" }));
  await screen.findByRole("button", { name: "Tentar movimentação novamente" });
  const guardado = sessionStorage.getItem(chave);
  expect(guardado).not.toBeNull();
  const chamada = enviar.mock.calls[0];
  if (!chamada) throw new Error("Envio esperado não ocorreu");
  expect(JSON.parse(guardado as string)).toEqual(chamada[0]);
  expect(concluido).not.toHaveBeenCalled();
});

it("sessão trocada após envio não confirma nem descarta o pedido", async () => {
  auth.getUser
    .mockResolvedValueOnce({
      data: { user: { id: "17690000-0000-4000-8000-000000000001" } },
      error: null,
    })
    .mockResolvedValueOnce({ data: { user: { id: "outra" } }, error: null });
  const enviar = vi.fn().mockImplementation(async (comando) => ({
    requestId: comando.requestId,
    aggregateId: comando.componenteId,
    revision: comando.expectedRevision,
    linkedIds: { clienteId: "17690000-0000-4000-8000-000000000002" },
  }));
  const concluido = vi.fn();
  render(
    <MovimentarComponente
      userId="17690000-0000-4000-8000-000000000001"
      clienteId="17690000-0000-4000-8000-000000000002"
      item={item}
      areas={[]}
      locais={[]}
      pais={[]}
      enviar={enviar}
      onConcluido={concluido}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirmar movimentação" }));
  await screen.findByRole("button", { name: "Tentar movimentação novamente" });
  const guardado = sessionStorage.getItem(chave);
  expect(guardado).not.toBeNull();
  const chamada = enviar.mock.calls[0];
  if (!chamada) throw new Error("Envio esperado não ocorreu");
  expect(JSON.parse(guardado as string)).toEqual(chamada[0]);
  expect(concluido).not.toHaveBeenCalled();
});

it.each([
  { clienteId: "17690000-0000-4000-8000-000000000003", areaId },
  {
    clienteId: "17690000-0000-4000-8000-000000000002",
    areaId: "17690000-0000-4000-8000-000000000022",
  },
])("recibo com Cliente ou destino divergente preserva o pedido", async (linkedIds) => {
  const enviar = vi.fn().mockImplementation(async (comando) => ({
    requestId: comando.requestId,
    aggregateId: comando.componenteId,
    revision: comando.expectedRevision + 1,
    linkedIds,
  }));
  const concluido = vi.fn();
  render(
    <MovimentarComponente
      userId="17690000-0000-4000-8000-000000000001"
      clienteId="17690000-0000-4000-8000-000000000002"
      item={item}
      areas={[{ id: areaId, nome: "Área A" }]}
      locais={[]}
      pais={[]}
      enviar={enviar}
      onConcluido={concluido}
    />,
  );
  fireEvent.change(screen.getByLabelText("Área de destino"), { target: { value: areaId } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar movimentação" }));
  await screen.findByRole("button", { name: "Tentar movimentação novamente" });
  const guardado = sessionStorage.getItem(chave);
  expect(guardado).not.toBeNull();
  const chamada = enviar.mock.calls[0];
  if (!chamada) throw new Error("Envio esperado não ocorreu");
  expect(JSON.parse(guardado as string)).toEqual(chamada[0]);
  expect(concluido).not.toHaveBeenCalled();
});

it("uma rejeição definitiva na primeira tentativa permite corrigir sem guardar pedido incerto", async () => {
  const enviar = vi.fn().mockRejectedValueOnce({ code: "23514" });
  render(
    <MovimentarComponente
      userId="17690000-0000-4000-8000-000000000001"
      clienteId="17690000-0000-4000-8000-000000000002"
      item={item}
      areas={[]}
      locais={[]}
      pais={[]}
      enviar={enviar}
      onConcluido={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirmar movimentação" }));
  await screen.findByText(/servidor rejeitou os vínculos/i);
  expect(sessionStorage.getItem(chave)).toBeNull();
  expect(screen.queryByRole("button", { name: "Tentar movimentação novamente" })).toBeNull();
});
