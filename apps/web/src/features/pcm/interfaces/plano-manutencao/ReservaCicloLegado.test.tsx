// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }) } }));
vi.mock("./diagnostico-revisao-sessao", () => ({ conferirSessaoDiagnostico: async () => {} }));
import { ReservaCicloLegado } from "./ReservaCicloLegado";
const id = (n: number) => `16610000-0000-4000-8000-${String(n).padStart(12, "0")}`;
afterEach(() => { cleanup(); sessionStorage.clear(); vi.resetAllMocks(); });
it("preserva a tentativa para replay quando o resultado da decisão é incerto", async () => {
 api.rpc.mockImplementation((nome: string) => nome === "sso_listar_ciclos_reserva_legado" ? { abortSignal: async () => ({ data: [{ preparada_id: id(5), vencimento_original: "2026-11-01", alvo_tipo: "sistema", alvo_id: id(6) }], error: null }) } : nome === "sso_consultar_reserva_ciclo_legado" ? { abortSignal: async () => ({ data: { cicloId: id(9), registrada: false, revisao: 0, efeitos: { ocorrenciaLegadaExistente: false, efeitoLegado: false, osLegada: false, chamadoSso: false, grupoSso: false, ponteExistente: false, ponteDivergente: false, osVinculadaSso: false, fontesExternasComprovadas: false }, fotoAtual: { planoRevisao: 1 }, vencimento: "2026-11-01", dataLegado: "2026-11-01", alvoTipo: "sistema", alvoId: id(6), indiceSolicitado: 0 }, error: null }) } : Promise.resolve({ data: null, error: new Error("rede") }));
 const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 render(<QueryClientProvider client={client}><ReservaCicloLegado userId={id(1)} clienteId={id(2)} planoId={id(3)} legadoId={id(4)} revision={1} modo="visita" consultando={false} /></QueryClientProvider>);
 await screen.findByRole("option", { name: /2026-11-01/ });
 fireEvent.change(screen.getByLabelText("Ciclo preparado"), { target: { value: id(5) } }); fireEvent.change(screen.getByLabelText("Índice legado"), { target: { value: "0" } });
 expect(await screen.findByText("Nenhuma reserva para este par.")).toBeTruthy();
 fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido com o PCM" } }); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
 expect(await screen.findByRole("button", { name: "Repetir mesma tentativa" })).toBeTruthy(); expect(sessionStorage.length).toBe(1);
});
