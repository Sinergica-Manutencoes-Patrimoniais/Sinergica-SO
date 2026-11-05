// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const externo = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: externo.getUser }, schema: () => ({ rpc: externo.rpc }) },
}));
import { IncluirFilaSelecionada } from "./IncluirFilaSelecionada";
function exigir<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error("Valor esperado ausente");
  return valor;
}
const id = (n: number) => `16610000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const itens = [
  { preparada_id: id(1), vencimento_original: "2026-11-10", rotina_id: id(3), alvo_id: id(4) },
  { preparada_id: id(2), vencimento_original: "2026-11-17", rotina_id: id(3), alvo_id: id(4) },
];
const props = { userId: "usuario", clienteId: id(5), planoId: id(6), itens, carregando: false };
function montar(tipo: "calendario" | "visita") {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <IncluirFilaSelecionada {...props} tipo={tipo} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  externo.getUser.mockResolvedValue({ data: { user: { id: "usuario" } }, error: null });
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});

it("inclui Visitas independentemente e retoma somente o item incerto com o mesmo pedido", async () => {
  let chamadas = 0;
  externo.rpc.mockImplementation(async (_nome, p) => {
    chamadas++;
    if (chamadas === 2) return { data: null, error: new Error("falha simulada") };
    return {
      data: {
        requestId: p.p_request_id,
        clienteId: props.clienteId,
        planoId: props.planoId,
        preparadaId: p.p_preparada_id,
        cicloId: id(p.p_preparada_id === id(1) ? 11 : 12),
        estado: p.p_preparada_id === id(1) ? "aguardando" : "verificacao",
        revision: 1,
        osCriada: false,
        tarefaAuvoCriada: false,
      },
      error: null,
    };
  });
  montar("visita");
  expect(screen.getByText(/processamento é sequencial/i)).toHaveTextContent(
    "não é um lote atômico",
  );
  fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(id(1)) }));
  fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(id(2)) }));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido pelo PCM" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /conferi as visitas/i }));
  fireEvent.click(screen.getByRole("button", { name: "Incluir selecionadas" }));
  expect(await screen.findByText(/Sequência interrompida após 1 de 2/)).toBeInTheDocument();
  expect(screen.getByText(/Confirmações: 1 de 2/)).toHaveTextContent(
    "os já confirmados permanecem incluídos",
  );
  const interrompido = exigir(externo.rpc.mock.calls[1])[1];
  expect(exigir(externo.rpc.mock.calls[0])[0]).toBe("sso_alterar_fila_visita");
  expect(sessionStorage.key(0)).toContain("sso-fila-visitas-selecionadas");
  fireEvent.click(screen.getByRole("button", { name: "Retomar mesma sequência" }));
  await waitFor(() => expect(screen.getByText(/Entradas registradas/)).toBeInTheDocument());
  expect(exigir(externo.rpc.mock.calls[2])[1]).toEqual(interrompido);
  expect(screen.getByLabelText("Resultado da inclusão")).toHaveTextContent(
    "verificação necessária",
  );
  expect(sessionStorage.length).toBe(0);
});

it("mantém a RPC de calendário existente", async () => {
  externo.rpc.mockResolvedValue({ data: null, error: new Error("falha simulada") });
  montar("calendario");
  fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(id(1)) }));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "PCM" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /conferi os ciclos/i }));
  fireEvent.click(screen.getByRole("button", { name: "Incluir selecionadas" }));
  await screen.findByText(/Sequência interrompida/);
  expect(exigir(externo.rpc.mock.calls[0])[0]).toBe("sso_alterar_fila_preventiva_pcm");
  expect(sessionStorage.key(0)).toContain("sso-fila-selecionada");
});
