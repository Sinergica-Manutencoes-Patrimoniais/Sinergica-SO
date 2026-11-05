// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentosStagingAtivo } from "./DocumentosStagingAtivo";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    schema: () => ({ rpc: mocks.rpc }),
    functions: { invoke: mocks.invoke },
    auth: { getUser: mocks.getUser },
  },
}));
const id = "10000000-0000-4000-8000-000000000001";
function montar() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DocumentosStagingAtivo userId="u" clienteId="c" tipo="componente" entidadeId={id} />
    </QueryClientProvider>,
  );
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  mocks.rpc.mockReset();
  mocks.invoke.mockReset();
  mocks.getUser.mockReset();
});
describe("documentos privados do ativo", () => {
  it("oculta documento durante nova verificação de sessão e em erro", async () => {
    vi.stubEnv("VITE_SSO_DOCUMENTOS_STAGING_ATIVO_ENABLED", "true");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    mocks.rpc.mockReturnValue({
      abortSignal: () =>
        Promise.resolve({
          data: [{ id, titulo: "Manual", criado_em: "2026-01-01T00:00:00+00:00" }],
          error: null,
        }),
    });
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={cliente}>
        <DocumentosStagingAtivo userId="u" clienteId="c" tipo="componente" entidadeId={id} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("button", { name: "Preparar download" })).toBeTruthy();
    let concluir!: (value: unknown) => void;
    mocks.getUser.mockReturnValue(
      new Promise((resolve) => {
        concluir = resolve;
      }),
    );
    act(() => {
      void cliente.invalidateQueries({
        queryKey: ["estrutura-tecnica", "u", "c", "componente", id, "documentos-staging"],
      });
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Preparar download" })).toBeNull(),
    );
    expect(screen.getByText("Carregando…")).toBeTruthy();
    concluir({ data: { user: { id: "outro" } }, error: null });
    expect(await screen.findByRole("alert")).toHaveTextContent("Documentos indisponíveis");
    expect(screen.queryByText("Manual")).toBeNull();
  });
  it("não cria URL ao receber PDF após desmontagem", async () => {
    vi.stubEnv("VITE_SSO_DOCUMENTOS_STAGING_ATIVO_ENABLED", "true");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    mocks.rpc.mockReturnValue({
      abortSignal: () =>
        Promise.resolve({
          data: [{ id, titulo: "Manual", criado_em: "2026-01-01T00:00:00+00:00" }],
          error: null,
        }),
    });
    let concluir!: (value: unknown) => void;
    mocks.invoke.mockReturnValue(
      new Promise((resolve) => {
        concluir = resolve;
      }),
    );
    const criar = vi.fn(() => "blob:documento");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() }));
    const tela = montar();
    fireEvent.click(await screen.findByRole("button", { name: "Preparar download" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    tela.unmount();
    concluir({ data: new Blob(["%PDF-"], { type: "application/pdf" }), error: null });
    await waitFor(() => expect(mocks.getUser.mock.calls.length).toBeGreaterThanOrEqual(4));
    expect(criar).not.toHaveBeenCalled();
  });
  it("recusa documento quando a sessão muda durante a resposta", async () => {
    vi.stubEnv("VITE_SSO_DOCUMENTOS_STAGING_ATIVO_ENABLED", "true");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    mocks.rpc.mockReturnValue({
      abortSignal: () =>
        Promise.resolve({
          data: [{ id, titulo: "Manual", criado_em: "2026-01-01T00:00:00+00:00" }],
          error: null,
        }),
    });
    let concluir!: (value: unknown) => void;
    mocks.invoke.mockReturnValue(
      new Promise((resolve) => {
        concluir = resolve;
      }),
    );
    const criar = vi.fn(() => "blob:documento");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() }));
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Preparar download" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    mocks.getUser.mockResolvedValue({ data: { user: { id: "outro" } }, error: null });
    concluir({ data: new Blob(["%PDF-"], { type: "application/pdf" }), error: null });
    expect(await screen.findByRole("alert")).toHaveTextContent("Documento indisponível");
    expect(criar).not.toHaveBeenCalled();
  });
});
