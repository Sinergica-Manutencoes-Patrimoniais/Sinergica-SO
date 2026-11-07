// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ receber: vi.fn(), getUser: vi.fn() }));
vi.mock("../../infrastructure/receber-estrutura-xlsx", () => ({ receberEstruturaXlsx: mocks.receber, reconciliarTentativaEstruturaXlsx: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: mocks.getUser } } }));
vi.mock("./PreviaXlsxEstrutura", () => ({ PreviaXlsxEstrutura: ({ enviarExperimental }: { enviarExperimental: (v: unknown) => Promise<string> }) =>
  <><input aria-label="Prévia" /><button type="button" onClick={() => void enviarExperimental({ bytes: new Uint8Array([1]), aba: "A", origem: "origem" })}>Enviar</button></> }));
import { ImportacaoXlsxExperimental } from "./ImportacaoXlsxExperimental";

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("mantém recepção oculta em build não DEV sem flag operacional", () => {
  vi.stubEnv("DEV", false); vi.stubEnv("VITE_SSO_ESTRUTURA_XLSX_DEV_ENABLED", "true"); vi.stubEnv("VITE_SSO_ESTRUTURA_XLSX_ENABLED", "false");
  render(<QueryClientProvider client={new QueryClient()}><ImportacaoXlsxExperimental userId="usuario" clienteId="cliente-a" /></QueryClientProvider>);
  expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
  expect(mocks.receber).not.toHaveBeenCalled();
});

it("mostra interface em build não DEV somente com flag específica, sem enviar automaticamente", () => {
  vi.stubEnv("DEV", false); vi.stubEnv("VITE_SSO_ESTRUTURA_XLSX_ENABLED", "true");
  render(<QueryClientProvider client={new QueryClient()}><ImportacaoXlsxExperimental userId="usuario" clienteId="cliente-a" /></QueryClientProvider>);
  expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument();
  expect(mocks.receber).not.toHaveBeenCalled();
});

it("não navega para resposta antiga após troca de Cliente, mesmo ao retornar ao anterior", async () => {
  vi.stubEnv("VITE_SSO_ESTRUTURA_XLSX_DEV_ENABLED", "true");
  let concluir!: (v: { destino: string; id: string }) => void;
  mocks.receber.mockReturnValueOnce(new Promise((resolve) => { concluir = resolve; }));
  mocks.getUser.mockResolvedValue({ data: { user: { id: "usuario" } }, error: null });
  const abrir = vi.fn();
  const client = new QueryClient();
  const tela = render(<QueryClientProvider client={client}><ImportacaoXlsxExperimental userId="usuario" clienteId="cliente-a" onRecebido={abrir} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
  tela.rerender(<QueryClientProvider client={client}><ImportacaoXlsxExperimental userId="usuario" clienteId="cliente-b" onRecebido={abrir} /></QueryClientProvider>);
  tela.rerender(<QueryClientProvider client={client}><ImportacaoXlsxExperimental userId="usuario" clienteId="cliente-a" onRecebido={abrir} /></QueryClientProvider>);
  concluir({ destino: "lote", id: "lote-a" });
  await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
  expect(abrir).not.toHaveBeenCalled();
});

it("descarta a prévia visual ao mudar de Cliente", () => {
  vi.stubEnv("VITE_SSO_ESTRUTURA_XLSX_DEV_ENABLED", "true");
  const client = new QueryClient();
  const tela = render(<QueryClientProvider client={client}><ImportacaoXlsxExperimental userId="usuario" clienteId="cliente-a" /></QueryClientProvider>);
  fireEvent.change(screen.getByRole("textbox", { name: "Prévia" }), { target: { value: "dados do Cliente A" } });
  tela.rerender(<QueryClientProvider client={client}><ImportacaoXlsxExperimental userId="usuario" clienteId="cliente-b" /></QueryClientProvider>);
  expect(screen.getByRole("textbox", { name: "Prévia" })).toHaveValue("");
});
