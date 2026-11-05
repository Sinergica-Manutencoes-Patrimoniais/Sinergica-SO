// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }) } }));
vi.mock("./diagnostico-revisao-sessao", () => ({ conferirSessaoDiagnostico: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./FilaAposPreparacao", () => ({ FilaAposPreparacao: ({ preparadaId }: { preparadaId: string }) => <p>Fila do ciclo: {preparadaId}</p> }));
import { LoteCiclosLegados } from "./LoteCiclosLegados";
const id = (n: number) => `16610000-0000-4000-8000-${String(n).padStart(12,"0")}`;
afterEach(() => { cleanup(); sessionStorage.clear(); vi.resetAllMocks(); });
it("encaminha somente ciclos confirmados no lote legado para a fila", async () => {
  api.rpc.mockImplementation(async (_nome, p) => ({ data: { requestId: p.p_request_id, total: 1, criadas: 1, itens: [{ preparadaId: id(1), legadaId: id(2), cicloId: id(3), criada: true }], atomico: true, osCriada: false, tarefaAuvoCriada: false, equivalenciaGeralComprovada: false }, error: null }));
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><LoteCiclosLegados userId="usuario" clienteId={id(4)} planoId={id(5)} legadoId={id(6)} relacaoId={id(7)} revision={1} candidatos={[{ preparada_id: id(1), vencimento_original: "2026-11-01", alvo_tipo: "sistema", alvo_id: id(8) }]} consultando={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("checkbox", { name: /2026-11-01/ }));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi os ciclos/i }));
  fireEvent.click(screen.getByRole("button", { name: "Processar lote" }));
  expect(await screen.findByText(`Fila do ciclo: ${id(1)}`)).toBeInTheDocument();
  expect(api.rpc).toHaveBeenCalledTimes(1);
});

it("restringe a janela visível sem presumir cobertura de páginas ausentes", () => {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><LoteCiclosLegados userId="usuario" clienteId={id(4)} planoId={id(5)} legadoId={id(6)} relacaoId={id(7)} revision={1} candidatos={[
    { preparada_id: id(1), vencimento_original: "2026-11-01", alvo_tipo: "sistema", alvo_id: id(8) },
    { preparada_id: id(2), vencimento_original: "2026-12-01", alvo_tipo: "sistema", alvo_id: id(8) },
  ]} consultando={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("checkbox", { name: /2026-11-01/ }));
  fireEvent.change(screen.getByLabelText("Início da janela"), { target: { value: "2026-12-01" } });
  expect(screen.queryByRole("checkbox", { name: /2026-11-01/ })).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /2026-12-01/ })).not.toBeChecked();
  expect(screen.getByText(/não comprova cobertura/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Fim da janela"), { target: { value: "2026-11-01" } });
  expect(screen.getByRole("alert")).toHaveTextContent("data inicial");
  expect(screen.getByRole("button", { name: "Processar lote" })).toBeDisabled();
});
