// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const fonte = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: fonte.rpc }) } }));
import { ComparacaoQuestionario } from "./ComparacaoQuestionario";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("oculta comparação armazenada após perda de acesso", async () => {
  fonte.rpc.mockReturnValue({ abortSignal: async () => ({ data: { estadoComparacao: "conteudo_integral_igual", impactoOperacionalCalculado: false, aprovacaoAutorizada: false }, error: null }) });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><ComparacaoQuestionario userId="u" clienteId="c" planoId="p" revisao={1} rotinaId="r" /></QueryClientProvider>);
  expect(await screen.findByText(/JSON integral igual/)).toBeTruthy();
  fonte.rpc.mockReturnValue({ abortSignal: async () => ({ data: null, error: { code: "42501" } }) });
  await act(async () => { await query.invalidateQueries({ queryKey: ["comparacao-questionario-revisao", "u", "c", "p", 1, "r"] }); });
  expect(await screen.findByRole("alert")).toHaveTextContent(/comparação indisponível/i);
  expect(screen.queryByText(/JSON integral igual/)).toBeNull();
});
