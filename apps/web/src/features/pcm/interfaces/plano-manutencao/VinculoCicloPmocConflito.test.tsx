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
import { VinculoCicloPmoc } from "./VinculoCicloPmoc";
const id = (n: number) => `16630000-1111-4000-8000-${String(n).padStart(12, "0")}`;
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it.each(["primeira", "replay"] as const)("trata divergência PMOC na %s tentativa", async (caso) => {
  vi.stubEnv("VITE_SSO_VINCULO_CICLO_PMOC_ENABLED", "true");
  let chamadas = 0;
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_consultar_vinculo_ciclo_pmoc"
      ? {
          abortSignal: async () => ({
            data: {
              propostaId: id(3),
              vinculoId: null,
              estado: "nao_vinculado",
              agendamentoId: null,
            },
            error: null,
          }),
        }
      : Promise.resolve({
          data: null,
          error:
            caso === "replay" && chamadas++ === 0
              ? new Error("rede")
              : { code: "P0019", message: "plano_alterado" },
        }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <VinculoCicloPmoc userId={id(1)} clienteId={id(2)} propostaId={id(3)} decisaoRevision={1} />
    </QueryClientProvider>,
  );
  await screen.findByLabelText("Referência da evidência");
  fireEvent.change(screen.getByLabelText("Referência da evidência"), {
    target: { value: "Registro" },
  });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Vincular ao PMOC" }));
  if (caso === "primeira") {
    await screen.findByText(/A proposta mudou/);
    expect(sessionStorage.length).toBe(0);
  } else {
    await screen.findByText(/Resultado não confirmado/);
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
    await waitFor(() =>
      expect(api.rpc.mock.calls.filter(([n]) => n === "sso_vincular_ciclo_pmoc")).toHaveLength(2),
    );
    expect(sessionStorage.length).toBe(1);
  }
});
