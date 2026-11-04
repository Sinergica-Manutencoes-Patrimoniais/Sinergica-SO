// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EvidenciasExcecao } from "./EvidenciasExcecao";

const api = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }), functions: { invoke: api.invoke }, auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });

it("não cria URL de evidência após sair da lista durante a leitura", async () => {
  vi.stubEnv("VITE_SSO_EVIDENCIAS_MATERIAIS_ENABLED", "true");
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [{ id: "16891000-0000-4000-8000-000000000001", criado_em: "2026-10-30T12:00:00Z" }], error: null }) });
  let resolver!: (value: unknown) => void;
  api.invoke.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
  const criar = vi.fn(() => "blob:teste");
  const URLOriginal = URL;
  vi.stubGlobal("URL", class extends URLOriginal { static override createObjectURL = criar; static override revokeObjectURL = vi.fn(); });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tela = render(<QueryClientProvider client={queryClient}><EvidenciasExcecao usuario="u" cliente="c" listaId="l" revision={1} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Ver evidência" }));
  await waitFor(() => expect(api.invoke).toHaveBeenCalledTimes(1));
  tela.unmount();
  resolver({ data: new Blob(["x"], { type: "image/png" }), error: null });
  await waitFor(() => expect(api.invoke).toHaveBeenCalledTimes(1));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(criar).not.toHaveBeenCalled();
});
