// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const fonte = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: fonte.rpc }) } }));
import { AvaliacaoImpactoRevisao } from "./AvaliacaoImpactoRevisao";
const parcial = { coberturaVisitasELegadoIndeterminada: true, impactoIntegralComprovado: false, aprovacaoAutorizada: false, ocorrenciasCalendarioObservadas: 4, decisoesAusentes: 2, decisoesObsoletas: 1, exigemReconciliacao: 1, fontesIndividuaisIncompletas: 3, comOsClienteDivergente: 0 };
const q = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
function montar(query: QueryClient, clienteId = "cliente-a", revisao = 5) { return <QueryClientProvider client={query}><AvaliacaoImpactoRevisao userId="usuario" clienteId={clienteId} planoId="plano" revisao={revisao} /></QueryClientProvider>; }
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllEnvs(); });

it("apresenta contagens parciais sem indicar aprovação", async () => {
  fonte.rpc.mockReturnValue({ abortSignal: async () => ({ data: parcial, error: null }) }); render(montar(q()));
  expect(await screen.findByText(/Ocorrências observadas 4/)).toHaveTextContent("decisões ausentes 2");
  expect(screen.getByText(/mesmo todas as contagens zeradas não liberam aprovação/i)).toBeTruthy();
  expect(fonte.rpc).toHaveBeenCalledWith("sso_avaliar_decisoes_impacto", { p_cliente_id: "cliente-a", p_plano_id: "plano", p_expected_plano: 5 });
});

it("recusa resposta que afirma aprovação ou completude", async () => {
  fonte.rpc.mockReturnValue({ abortSignal: async () => ({ data: { ...parcial, aprovacaoAutorizada: true }, error: null }) }); render(montar(q()));
  expect(await screen.findByRole("alert")).toHaveTextContent(/avaliação indisponível/i);
  expect(screen.queryByText(/Ocorrências observadas 4/)).toBeNull();
});

it("não mantém contagens após perda de acesso", async () => {
  fonte.rpc.mockReturnValue({ abortSignal: async () => ({ data: parcial, error: null }) }); const query = q(); render(montar(query));
  expect(await screen.findByText(/Ocorrências observadas 4/)).toBeTruthy();
  fonte.rpc.mockReturnValue({ abortSignal: async () => ({ data: null, error: { code: "42501" } }) });
  await act(async () => { await query.invalidateQueries({ queryKey: ["avaliacao-impacto-revisao", "usuario", "cliente-a", "plano", 5] }); });
  expect(await screen.findByRole("alert")).toHaveTextContent(/avaliação indisponível/i);
  expect(screen.queryByText(/Ocorrências observadas 4/)).toBeNull();
});

it("não exibe dados do Cliente anterior após mudança de contexto", async () => {
  fonte.rpc.mockImplementation((_nome: string, args: { p_cliente_id: string }) => ({ abortSignal: async () => args.p_cliente_id === "cliente-a" ? { data: parcial, error: null } : { data: null, error: { code: "42501" } } }));
  const query = q(); const tela = render(montar(query)); expect(await screen.findByText(/Ocorrências observadas 4/)).toBeTruthy();
  tela.rerender(montar(query, "cliente-b")); expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText(/Ocorrências observadas 4/)).toBeNull();
});
