// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));

const api = vi.hoisted(() => ({ listar: vi.fn(), decidir: vi.fn(), detalhe: vi.fn(), pdf: vi.fn() }));
vi.mock("../../../lib/pdf/relatorio-pdf", () => ({ criarRelatorioPdf: api.pdf }));
vi.mock("../infrastructure/supabase-portal-propostas-os-adapter", async (importOriginal) => {
 const original = await importOriginal<typeof import("../infrastructure/supabase-portal-propostas-os-adapter")>();
 return { ...original, listarPropostasOs: api.listar, decidirPropostaOs: api.decidir, obterDetalheOperacional: api.detalhe, conferirSessaoProposta: vi.fn().mockResolvedValue(undefined) };
});
vi.mock("./HistoricoPropostaOs", () => ({ HistoricoPropostaOs: () => null }));
import { PropostasOsPortal } from "./PropostasOsPortal";

const userId = "18320000-0000-0000-0000-000000000001";
const clienteA = "18320000-0000-0000-0000-00000000000a";
const clienteB = "18320000-0000-0000-0000-00000000000b";
const osId = "18320000-0000-0000-0000-000000000011";
const propostaId = "18320000-0000-0000-0000-000000000021";
const proposta = { id: propostaId, ordem_servico_id: osId, status: "enviada", versao: 4, valido_ate: null, payload: { proposta: { escopo: "Serviço A", preco_centavos: 15000 }, itens: [] } };
function montar(clienteId = clienteA) {
 const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
 return render(<QueryClientProvider client={client}><PropostasOsPortal userId={userId} clienteId={clienteId} osId={osId} clienteNome="Cliente" /></QueryClientProvider>);
}
beforeEach(() => { sessionStorage.clear(); vi.stubEnv("VITE_SSO_PORTAL_PROPOSTA_OS_ENABLED", "true"); vi.stubEnv("VITE_SSO_PROPOSTA_ITENS_PUBLICOS_ENABLED", "false"); vi.stubEnv("VITE_SSO_EXPORTAR_PROPOSTA_OPERACIONAL_ENABLED", "false"); api.listar.mockReset().mockImplementation(async (id: string) => id === clienteA ? [proposta] : Promise.reject(new Error("sem acesso"))); api.decidir.mockReset().mockResolvedValue(undefined); });
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Portal de decisões de proposta", () => {
 it("aprova somente a versão apresentada", async () => {
  montar(); await screen.findByText("Serviço A");
  fireEvent.click(screen.getByLabelText("Conferi esta versão para aprovação."));
  fireEvent.click(screen.getByRole("button", { name: "Aprovar esta versão" }));
  await waitFor(() => expect(api.decidir.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ propostaId, versao: 4, decisao: "aceita", motivo: null })));
 });
 it("recusa só após motivo e preserva mesmo request em falha", async () => {
  api.decidir.mockRejectedValue(new Error("resultado incerto")); montar(); await screen.findByText("Serviço A");
  expect(screen.getByRole("button", { name: "Recusar esta versão" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Motivo da recusa"), { target: { value: "Não atende" } });
  fireEvent.click(screen.getByLabelText("Conferi esta versão e o motivo para recusa."));
  fireEvent.click(screen.getByRole("button", { name: "Recusar esta versão" }));
  expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy(); const primeiro = api.decidir.mock.calls[0]?.[0];
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  await waitFor(() => expect(api.decidir).toHaveBeenCalledTimes(2)); expect(api.decidir.mock.calls[1]?.[0]).toEqual(primeiro);
 });
 it("não exibe proposta de outra Conta quando acesso é negado", async () => {
  const { unmount } = montar(); await screen.findByText("Serviço A"); unmount(); montar(clienteB);
  expect(await screen.findByRole("alert")).toHaveTextContent("Orçamentos indisponíveis ou sem acesso");
  expect(screen.queryByText("Serviço A")).toBeNull();
  expect(api.listar).toHaveBeenCalledWith(clienteB, osId, null, expect.anything(), userId);
 });
 it("não baixa PDF de Conta anterior quando troca ocorre durante exportação", async () => {
  vi.stubEnv("VITE_SSO_EXPORTAR_PROPOSTA_OPERACIONAL_ENABLED", "true");
  let concluir!: (valor: typeof proposta.payload) => void;
  api.detalhe.mockReset().mockImplementationOnce(() => new Promise((resolve) => { concluir = resolve; })).mockResolvedValue(proposta.payload);
  const finalizar = vi.fn().mockResolvedValue(new Uint8Array([1]));
  api.pdf.mockReset().mockResolvedValue({ escreverTexto: vi.fn(), finalizar });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:teste"), revokeObjectURL: vi.fn() }));
  const { unmount } = montar(); await screen.findByText("Serviço A");
  fireEvent.click(screen.getByRole("button", { name: "Baixar versão pública em PDF" }));
  await waitFor(() => expect(api.detalhe).toHaveBeenCalledTimes(1));
  unmount(); montar(clienteB); concluir(proposta.payload);
  await waitFor(() => expect(finalizar).toHaveBeenCalled());
  await waitFor(() => expect(api.detalhe).toHaveBeenCalledTimes(2));
  expect(click).not.toHaveBeenCalled();
 });
});
