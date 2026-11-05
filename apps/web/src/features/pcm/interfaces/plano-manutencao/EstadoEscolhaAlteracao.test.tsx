// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } } }));
vi.mock("./ResolverRetiradaImpacto", () => ({ ResolverRetiradaImpacto: () => <p>Fluxo de retirada</p> }));
import { EstadoEscolhaAlteracao } from "./EstadoEscolhaAlteracao";
const preparadaId = "16630000-1111-4000-8000-000000000061";
const props = { userId: "usuario", clienteId: "cliente", planoId: "plano", rascunhoId: "rascunho", preparadaId, planoRevision: 2, decisaoRevision: 1, tipo: "calendario" as const };
const montar = (registrada: boolean, atual: boolean) => { vi.stubEnv("VITE_SSO_ALTERACAO_CICLO_ENABLED", "true"); api.rpc.mockImplementation(() => ({ abortSignal: () => Promise.resolve({ data: { preparadaId, revisaoDecisao: 1, registrada, atual }, error: null }) })); render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><EstadoEscolhaAlteracao {...props} /></QueryClientProvider>); };
afterEach(() => { cleanup(); vi.unstubAllEnvs(); api.rpc.mockReset(); });
it("reapresenta alteração atual após recarga", async () => { montar(true, true); expect(await screen.findByText(/Alteração escolhida para esta ocorrência/)).toBeInTheDocument(); expect(screen.queryByText("Fluxo de retirada")).toBeNull(); });
it("orienta nova decisão para escolha obsoleta", async () => { montar(true, false); expect(await screen.findByText(/escolha de alteração está desatualizada/)).toBeInTheDocument(); });
it("mantém retirada para decisão sem escolha de alteração", async () => { montar(false, false); expect(await screen.findByText("Fluxo de retirada")).toBeInTheDocument(); });

it("reapresenta nova data escolhida após recarga", async () => {
 vi.stubEnv("VITE_SSO_ALTERACAO_CICLO_ENABLED", "true"); vi.stubEnv("VITE_SSO_NOVA_DATA_CICLO_ENABLED", "true");
 api.rpc.mockImplementation((nome: string) => ({ abortSignal: () => Promise.resolve({ data: nome === "sso_consultar_nova_data_calendario" ? { preparadaId, revisaoDecisao: 1, registrada: true, atual: true, data: "2026-12-05", indice: 2 } : { preparadaId, revisaoDecisao: 1, registrada: false, atual: false }, error: null }) }));
 render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><EstadoEscolhaAlteracao {...props} /></QueryClientProvider>);
 expect(await screen.findByText(/Nova data escolhida: 2026-12-05/)).toBeInTheDocument(); expect(screen.queryByText("Fluxo de retirada")).toBeNull();
});

it("reapresenta nova Visita escolhida após recarga", async () => {
 vi.stubEnv("VITE_SSO_NOVA_DATA_VISITA_ENABLED", "true");
 api.rpc.mockImplementation((nome: string) => ({ abortSignal: () => Promise.resolve({ data: nome === "sso_consultar_escolha_nova_visita" ? { requestId: "16630000-1111-4000-8000-000000000001", preparadaId, visitaId: "16630000-1111-4000-8000-000000000081", data: "2026-12-05", serieId: "16630000-1111-4000-8000-000000000082", semanaOrigem: "2026-11-30", fonteFeriados: "Conferido", atual: true, fontesFeriadosCompletas: false, substituicaoAplicada: false } : { preparadaId, revisaoDecisao: 1, registrada: false, atual: false }, error: null }) }));
 render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><EstadoEscolhaAlteracao {...props} tipo="visita" /></QueryClientProvider>);
 expect(await screen.findByText(/Nova Visita escolhida: 2026-12-05/)).toBeInTheDocument(); expect(screen.queryByText("Fluxo de retirada")).toBeNull();
});
