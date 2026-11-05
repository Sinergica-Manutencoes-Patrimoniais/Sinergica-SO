// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }) } }));
vi.mock("./diagnostico-revisao-sessao", () => ({ conferirSessaoDiagnostico: async () => {} }));
import { CompararCalendarioLegado } from "./CompararCalendarioLegado";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("apresenta os ciclos por origem sem afirmar equivalência geral", async () => {
 api.rpc.mockReturnValue({ abortSignal: async () => ({ data: { comparacao: "datas_diferentes_na_janela", ciclosSso: 1, ciclosLegados: 1, datasComuns: 0, equivalenciaGeralComprovada: false, impactoCalculado: false, geradorAlterado: false, datasTeoricas: true, datas: [{ data: "2026-11-01", sso: true, legado: false, indiceSso: 0, indiceLegado: null }, { data: "2026-11-02", sso: false, legado: true, indiceSso: null, indiceLegado: 2 }] }, error: null }) });
 const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 render(<QueryClientProvider client={client}><CompararCalendarioLegado userId="u" clienteId="c" planoId="p" versaoId="v" rotinaId="r" legadoId="l" /></QueryClientProvider>);
 fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-11-01" } });
 fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-11-03" } });
 fireEvent.click(screen.getByRole("button", { name: "Comparar datas" }));
 expect(await screen.findByText(/2026-11-01 · SSO ciclo 0/)).toBeTruthy();
 expect(screen.getByText(/2026-11-02 · sem ciclo SSO · legado índice 2/)).toBeTruthy();
 expect(screen.getByText(/Igualdade na janela não comprova equivalência geral/)).toBeTruthy();
});
