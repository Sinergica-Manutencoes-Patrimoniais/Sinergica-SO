// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }) } }));
vi.mock("./diagnostico-revisao-sessao", () => ({ conferirSessaoDiagnostico: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./RegistrarOcorrenciaGrupo", () => ({ RegistrarOcorrenciaGrupo: () => <p>Registrar Grupo</p> }));
import { ConferirGrupoFila } from "./ConferirGrupoFila";
const id = (n: number) => `16610000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const previa = { tipo: "calendario", preparadaId: id(1), cicloId: id(2), grupoId: id(3), filaRevisao: 1, filaEstado: "verificacao", gruposRegistrados: 1, efeitosLocais: 0, fotografiaHash: "a".repeat(64), confirmavel: true, fontesExternasComprovadas: false };
afterEach(() => { cleanup(); sessionStorage.clear(); vi.resetAllMocks(); });
it("registra fontes e motivo sem confirmar automaticamente a fila", async () => {
  api.rpc.mockImplementation((nome, p) => nome === "sso_prever_fila_grupo" ? { abortSignal: async () => ({ data: previa, error: null }) } : Promise.resolve({ data: { requestId: p.p_request, clienteId: p.p_cliente, planoId: p.p_plano, preparadaId: p.p_preparada, tipo: p.p_tipo, cicloId: id(2), grupoId: id(3), filaAlterada: false, osAlteradas: false, fontesExternasComprovadas: false, declaracaoExplicita: true }, error: null }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ConferirGrupoFila userId="usuario" clienteId={id(4)} planoId={id(5)} preparadaId={id(1)} tipo="calendario" /></QueryClientProvider>);
  await screen.findByText(/identidades registradas 1/);
  expect(screen.getByText(/não comprova ausência de execução/i)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Fontes consultadas"), { target: { value: "Livro de campo e SSO" } });
  fireEvent.change(screen.getByLabelText("Motivo da decisão PCM"), { target: { value: "Revisão realizada" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /não identifiquei execução nas fontes informadas/i }));
  fireEvent.click(screen.getByRole("button", { name: "Registrar declaração PCM" }));
  await waitFor(() => expect(screen.getByText(/Declaração PCM registrada/)).toBeInTheDocument());
  expect(api.rpc.mock.calls.filter(([nome]) => nome === "sso_declarar_fila_grupo_confirmado")).toHaveLength(1);
  expect(api.rpc.mock.calls.filter(([nome]) => nome === "sso_confirmar_fila_preventiva")).toHaveLength(0);
});
