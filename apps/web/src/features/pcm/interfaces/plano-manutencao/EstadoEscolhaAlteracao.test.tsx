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
