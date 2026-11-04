// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const fonte = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: fonte.rpc }) } }));
import { DiagnosticoOsRevisao } from "./DiagnosticoOsRevisao";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("oculta diagnóstico e OS em cache após perda de acesso à lista", async () => {
  let negado = false;
  fonte.rpc.mockImplementation((nome: string) => ({ abortSignal: async () => nome === "sso_listar_os_abertas_revisao" ? negado ? { data: null, error: { code: "42501" } } : { data: [{ os_id: "os-1", ocorrencia_id: "o", rotina_id: "r", vencimento_original: "2026-11-01", status: "aberta" }], error: null } : { data: { fontesIncompletas: true, impactoOperacionalCalculado: false, ausenciaDeImpactoComprovada: false, ocorrenciasCalendarioPreparadas: 1, ocorrenciasSemPonte: 0, osVinculadasMesmoCliente: 1, osAbertasMesmoCliente: 1, osClienteDivergente: 0 }, error: null } }));
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><DiagnosticoOsRevisao userId="u" clienteId="c" planoId="p" revisao={1} /></QueryClientProvider>);
  expect(await screen.findByText(/OS os-1/)).toBeTruthy(); negado = true;
  await act(async () => { await query.invalidateQueries({ queryKey: ["os-abertas-revisao", "u", "c", "p", 1] }); });
  expect(await screen.findByRole("alert")).toHaveTextContent(/lista indisponível/i);
  expect(screen.queryByText(/OS os-1/)).toBeNull();
  expect(screen.queryByText(/Ocorrências preparadas:/)).toBeNull();
});
