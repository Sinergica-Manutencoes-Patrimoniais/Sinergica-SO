// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
const id = (n: number) => `17600000-0000-4000-8000-${String(n).padStart(12, "0")}`;
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({
        data: { user: { id: "17600000-0000-4000-8000-000000000001" } },
        error: null,
      }),
    },
    schema: () => ({ rpc: api.rpc }),
  },
}));
import { ExcecaoVisita } from "./ExcecaoVisita";
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("aprova com dados locais do servidor e registra tentativa idempotente", async () => {
  vi.stubEnv("VITE_SSO_EXCECAO_VISITA_ENABLED", "true");
  const aoAprovar = vi.fn();
  api.rpc.mockImplementation((nome: string, args: Record<string, unknown>) =>
    nome === "sso_consultar_excecao_visita"
      ? {
          abortSignal: async () => ({
            data: { visitaId: id(3), aprovada: false, revisaoAtual: 2, dataAtual: "2026-11-06" },
            error: null,
          }),
        }
      : Promise.resolve({
          data: {
            requestId: args.p_request,
            visitaId: id(3),
            revisaoVisita: 2,
            aprovada: true,
            visitaAlterada: false,
            osAlteradas: false,
            tarefaAuvoCriada: false,
          },
          error: null,
        }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ExcecaoVisita userId={id(1)} clienteId={id(2)} visitaId={id(3)} aoAprovar={aoAprovar} />
    </QueryClientProvider>,
  );
  await screen.findByText(/Data local 2026-11-06/);
  fireEvent.change(screen.getByLabelText("Origem"), { target: { value: "PCM" } });
  fireEvent.change(screen.getByLabelText("Natureza"), { target: { value: "ajuste" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Aprovar exceção" }));
  await screen.findByText(/Exceção aprovada\. A Visita/);
  expect(aoAprovar).toHaveBeenCalledOnce();
  expect(sessionStorage.length).toBe(0);
  expect(api.rpc).toHaveBeenCalledWith(
    "sso_aprovar_excecao_visita",
    expect.objectContaining({ p_data: "2026-11-06", p_revisao: 2 }),
  );
});
it("preserva tentativa quando o resultado é incerto", async () => {
  vi.stubEnv("VITE_SSO_EXCECAO_VISITA_ENABLED", "true");
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_consultar_excecao_visita"
      ? {
          abortSignal: async () => ({
            data: { visitaId: id(3), aprovada: false, revisaoAtual: 1, dataAtual: "2026-11-06" },
            error: null,
          }),
        }
      : Promise.resolve({ data: null, error: new Error("rede") }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ExcecaoVisita userId={id(1)} clienteId={id(2)} visitaId={id(3)} aoAprovar={() => {}} />
    </QueryClientProvider>,
  );
  await screen.findByText(/Data local/);
  fireEvent.change(screen.getByLabelText("Origem"), { target: { value: "PCM" } });
  fireEvent.change(screen.getByLabelText("Natureza"), { target: { value: "ajuste" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Aprovar exceção" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(screen.getByRole("button", { name: "Repetir mesma aprovação" })).toBeTruthy();
  expect(sessionStorage.length).toBe(1);
});
it.each([{ code: "40001" }, { code: "P0011", message: "visita_obsoleta" }])(
  "permite nova conferência após rejeição inicial $code",
  async (erro) => {
    vi.stubEnv("VITE_SSO_EXCECAO_VISITA_ENABLED", "true");
    api.rpc.mockImplementation((nome: string) =>
      nome === "sso_consultar_excecao_visita"
        ? {
            abortSignal: async () => ({
              data: { visitaId: id(3), aprovada: false, revisaoAtual: 1, dataAtual: "2026-11-06" },
              error: null,
            }),
          }
        : Promise.resolve({ data: null, error: erro }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ExcecaoVisita userId={id(1)} clienteId={id(2)} visitaId={id(3)} aoAprovar={() => {}} />
      </QueryClientProvider>,
    );
    await screen.findByText(/Data local/);
    fireEvent.change(screen.getByLabelText("Origem"), { target: { value: "PCM" } });
    fireEvent.change(screen.getByLabelText("Natureza"), { target: { value: "ajuste" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Aprovar exceção" }));
    await screen.findByText(/A Visita mudou/);
    expect(sessionStorage.length).toBe(0);
  },
);
it("preserva tentativa incerta ao receber P0011 no replay", async () => {
  vi.stubEnv("VITE_SSO_EXCECAO_VISITA_ENABLED", "true");
  let chamadas = 0;
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_consultar_excecao_visita"
      ? {
          abortSignal: async () => ({
            data: { visitaId: id(3), aprovada: false, revisaoAtual: 1, dataAtual: "2026-11-06" },
            error: null,
          }),
        }
      : Promise.resolve({
          data: null,
          error:
            chamadas++ === 0 ? new Error("rede") : { code: "P0011", message: "visita_obsoleta" },
        }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ExcecaoVisita userId={id(1)} clienteId={id(2)} visitaId={id(3)} aoAprovar={() => {}} />
    </QueryClientProvider>,
  );
  await screen.findByText(/Data local/);
  fireEvent.change(screen.getByLabelText("Origem"), { target: { value: "PCM" } });
  fireEvent.change(screen.getByLabelText("Natureza"), { target: { value: "ajuste" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Aprovar exceção" }));
  await screen.findByText(/Resultado não confirmado/);
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesma aprovação" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Repetir mesma aprovação" })).not.toBeDisabled(),
  );
  expect(chamadas).toBe(2);
  expect(sessionStorage.length).toBe(1);
});
