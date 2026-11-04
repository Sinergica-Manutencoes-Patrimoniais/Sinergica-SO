// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const externo = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: externo.getUser }, schema: () => ({ rpc: externo.rpc }) } }));
vi.mock("./OrigemGeracaoRotina", () => ({ OrigemGeracaoRotina: () => null }));
vi.mock("./ConferenciaPmocCiclo", () => ({ ConferenciaPmocCiclo: () => null }));
vi.mock("./LoteOcorrenciasVisita", () => ({ LoteOcorrenciasVisita: () => null }));
vi.mock("./FilaPreventivaPcm", () => ({ FilaPreventivaPcm: ({ preparadaId, tipo }: { preparadaId: string; tipo: string }) => <p>Fila {tipo}: {preparadaId}</p> }));
import { PreviaOcorrenciasVisita } from "./PreviaOcorrenciasVisita";
const id = (n: string) => `16610000-0000-4000-8000-${n.padStart(12, "0")}`;
beforeEach(() => { vi.stubEnv("VITE_SSO_MATERIALIZAR_VISITA_CANONICA_ENABLED", "true"); vi.stubEnv("VITE_SSO_FILA_VISITA_ENABLED", "true"); externo.getUser.mockResolvedValue({ data: { user: { id: "usuario" } }, error: null }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllEnvs(); sessionStorage.clear(); });

it("encaminha o recibo de preparação individual para a fila, sem incluí-lo automaticamente", async () => {
  externo.rpc.mockImplementation((nome, p) => nome === "sso_prever_visitas_rotina" ? { abortSignal: async () => ({ data: [{ visita_id: id("1"), semana_origem: "2026-11-02", vencimento_original: "2026-11-06", estado_visita: "planejada", feriado_declarado: false, vigencia_declarada: true, ocorrencia_preparada: false }], error: null }) } : Promise.resolve({ data: { requestId: p.p_request_id, visitaId: p.p_visita_id, ocorrenciaId: id("2"), cicloVisitaId: id("3"), osCriada: false, tarefaAuvoCriada: false }, error: null }));
  const query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={query}><PreviaOcorrenciasVisita userId="usuario" clienteId={id("4")} planoId={id("5")} versaoId={id("6")} rotinaId={id("7")} serieId={id("8")} revision={1} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-11-30" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar Visitas" }));
  fireEvent.click(await screen.findByRole("button", { name: "Conferir preparação" }));
  fireEvent.change(screen.getByLabelText("Fonte consultada para declarar dia sem feriado"), { target: { value: "Calendário PCM" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /confirmei visita/i }));
  fireEvent.click(screen.getByRole("button", { name: "Preparar ocorrência sem envio" }));
  fireEvent.click(await screen.findByRole("button", { name: "Conferir inclusão na fila" }));
  expect(screen.getByText(`Fila visita: ${id("2")}`)).toBeInTheDocument();
  expect(externo.rpc.mock.calls.filter(([nome]) => nome === "sso_alterar_fila_visita")).toHaveLength(0);
});
