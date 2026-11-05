// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: api.rpc }) },
}));
vi.mock("./diagnostico-revisao-sessao", () => ({
  conferirSessaoDiagnostico: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./ClassificarLegadoNaoRelacionado", () => ({
  ClassificarLegadoNaoRelacionado: () => null,
}));
import { RelacaoPlanoLegado } from "./RelacaoPlanoLegado";
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});
it.each(["primeira", "replay"] as const)(
  "trata revisão obsoleta da relação na %s tentativa",
  async (caso) => {
    let envios = 0;
    api.rpc.mockImplementation((nome: string) =>
      nome === "sso_planos_legados_mediados"
        ? {
            abortSignal: async () => ({
              data: [
                {
                  id: "legado",
                  nome: "Legado",
                  estado: "ativo",
                  sistema_id: null,
                  equipamento_id: null,
                  primeira_data: "2026-01-01",
                  intervalo_n: 1,
                  intervalo_unidade: "meses",
                },
              ],
              error: null,
            }),
          }
        : nome === "sso_historico_relacao_legada_mediado"
          ? { abortSignal: async () => ({ data: [], error: null }) }
          : Promise.resolve({
              data: null,
              error:
                caso === "replay" && envios++ === 0
                  ? new Error("rede")
                  : { code: "P0011", message: "revisao_obsoleta" },
            }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <RelacaoPlanoLegado userId="usuario" clienteId="cliente" planoId="plano" revision={1} />
      </QueryClientProvider>,
    );
    await screen.findByRole("option", { name: /Legado/ });
    fireEvent.change(screen.getByLabelText("Plano legado"), { target: { value: "legado" } });
    await screen.findByText(/Próxima decisão/);
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Confirmo a decisão/ }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
    if (caso === "primeira") {
      await screen.findByText(/A relação mudou/);
      expect(sessionStorage.length).toBe(0);
    } else {
      await screen.findByText(/Resultado não confirmado/);
      fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
      await waitFor(() =>
        expect(
          api.rpc.mock.calls.filter(([n]) => n === "sso_declarar_relacao_legada_mediada"),
        ).toHaveLength(2),
      );
      expect(sessionStorage.length).toBe(1);
    }
  },
);


it.each([["planoId", "outro"], ["planoLegadoId", "outro"], ["revisao", 99], ["decisao", "retirar"]])(
  "preserva pedido para recibo divergente em %s e repete a mesma chamada",
  async (campo, valor) => {
    let n = 0;
    api.rpc.mockImplementation((nome: string, args: Record<string, unknown>) => {
      if (nome === "sso_planos_legados_mediados") return { abortSignal: async () => ({ data: [{ id: "legado", nome: "Legado", estado: "ativo", sistema_id: null, equipamento_id: null, primeira_data: "2026-01-01", intervalo_n: 1, intervalo_unidade: "meses" }], error: null }) };
      if (nome === "sso_historico_relacao_legada_mediado") return { abortSignal: async () => ({ data: [], error: null }) };
      const recibo = { requestId: args.p_request_id, planoId: args.p_plano_id, planoLegadoId: args.p_plano_legado_id, revisao: Number(args.p_expected_revision) + 1, decisao: args.p_decisao, equivalenciaComprovada: false, geradorAlterado: false };
      return Promise.resolve({ data: ++n === 1 ? { ...recibo, [campo]: valor } : recibo, error: null });
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><RelacaoPlanoLegado userId="usuario" clienteId="cliente" planoId="plano" revision={1} /></QueryClientProvider>);
    await screen.findByRole("option", { name: /Legado/ });
    fireEvent.change(screen.getByLabelText("Plano legado"), { target: { value: "legado" } });
    await screen.findByText(/Próxima decisão/);
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Confirmo a decisão/ }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
    await screen.findByText(/Resultado não confirmado/);
    expect(sessionStorage.length).toBe(1);
    const salvo = sessionStorage.getItem(sessionStorage.key(0)!);
    expect(salvo).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
    await waitFor(() => expect(sessionStorage.length).toBe(0));
    const chamadas = api.rpc.mock.calls.filter(([nome]) => nome === "sso_declarar_relacao_legada_mediada");
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1]).toEqual(chamadas[0]);
  },
);
