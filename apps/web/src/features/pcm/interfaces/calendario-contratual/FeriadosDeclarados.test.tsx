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
import { FeriadosDeclarados } from "./FeriadosDeclarados";

const chave = `sso-feriado-declarado:${JSON.stringify(["u", "c"])}`;
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});
function tela() {
  api.schema.mockReturnValue({ rpc: api.rpc });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onUsar = vi.fn();
  const montar = (userId = "u") => (
    <QueryClientProvider client={client}>
      <FeriadosDeclarados userId={userId} clienteId="c" contratos={[]} onUsar={onUsar} />
    </QueryClientProvider>
  );
  return { ...render(montar()), montar, onUsar, client };
}
function preencher() {
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-12-25" } });
  fireEvent.change(screen.getByLabelText("Fonte declarada"), { target: { value: "Calendário" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Feriado" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar declaração" }));
}
it("não apaga tentativa substituída enquanto a declaração é processada", async () => {
  let responder!: (v: unknown) => void;
  api.rpc.mockImplementation(
    () =>
      new Promise((r) => {
        responder = r;
      }),
  );
  tela();
  preencher();
  await waitFor(() => expect(api.rpc).toHaveBeenCalledTimes(1));
  const pedido = api.rpc.mock.calls[0]![1];
  sessionStorage.setItem(chave, "tentativa nova");
  responder({
    data: {
      requestId: pedido.p_request_id,
      feriadoId: pedido.p_feriado_id,
      revision: 1,
      ativo: true,
    },
    error: null,
  });
  await waitFor(() => expect(screen.getByText(/tentativa.*alterada/i)).toBeTruthy());
  expect(sessionStorage.getItem(chave)).toBe("tentativa nova");
});
it("não repete pedido quando outra instância substitui o armazenamento", async () => {
  api.rpc.mockResolvedValue({ data: null, error: new Error("rede") });
  tela();
  preencher();
  const repetir = await screen.findByRole("button", { name: "Repetir mesmo pedido" });
  await waitFor(() => expect((repetir as HTMLButtonElement).disabled).toBe(false));
  sessionStorage.setItem(chave, "tentativa nova");
  fireEvent.click(repetir);
  expect(await screen.findByText(/tentativa.*alterada/i)).toBeTruthy();
  expect(api.rpc).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(chave)).toBe("tentativa nova");
});
it("não oferece tentativa de usuário anterior após troca de sessão", () => {
  sessionStorage.setItem(
    chave,
    JSON.stringify({
      requestId: "r",
      clienteId: "c",
      id: "f",
      revision: 0,
      acao: "declarar",
      contratoId: null,
      data: "2026-12-25",
      fonte: "Calendário",
      motivo: "Feriado",
    }),
  );
  const { rerender, montar } = tela();
  expect(screen.getByRole("button", { name: "Repetir mesmo pedido" })).toBeTruthy();
  rerender(montar("outro"));
  expect(screen.queryByRole("button", { name: "Repetir mesmo pedido" })).toBeNull();
  expect(sessionStorage.getItem(chave)).not.toBeNull();
});
it("repete exatamente a mesma declaração após falha incerta", async () => {
  api.rpc.mockResolvedValueOnce({ data: null, error: new Error("rede") });
  api.rpc.mockImplementationOnce((_nome, p) =>
    Promise.resolve({
      data: { requestId: p.p_request_id, feriadoId: p.p_feriado_id, revision: 1, ativo: true },
      error: null,
    }),
  );
  const { onUsar } = tela();
  preencher();
  const repetir = await screen.findByRole("button", { name: "Repetir mesmo pedido" });
  await waitFor(() => expect((repetir as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(repetir);
  await waitFor(() => expect(api.rpc).toHaveBeenCalledTimes(2));
  expect(api.rpc.mock.calls[1]![1]).toEqual(api.rpc.mock.calls[0]![1]);
  await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
  expect(onUsar).toHaveBeenCalledWith(null, []);
});
