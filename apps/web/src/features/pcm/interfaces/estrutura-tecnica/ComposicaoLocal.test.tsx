// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComposicaoLocal } from "./ComposicaoLocal";

const m = vi.hoisted(() => ({ autorizar: vi.fn(), from: vi.fn(), rows: {} as Record<string, unknown[]>, falha: "" }));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({ supabaseCapacidadesSsoAdapter: { autorizarAcao: m.autorizar } }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ from: m.from }) } }));
vi.mock("./HistoricoGrupo", () => ({ HistoricoGrupo: () => null }));
vi.mock("./FotosGrupo", () => ({ FotosGrupo: () => null }));
vi.mock("./FotosStagingGrupo", () => ({ FotosStagingGrupo: () => null }));
vi.mock("./FotosStagingAtivo", () => ({ FotosStagingAtivo: () => null }));
const localId="10000000-0000-4000-8000-000000000001", itemId="10000000-0000-4000-8000-000000000002", sistemaId="10000000-0000-4000-8000-000000000003";
function montar() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions:{queries:{retry:false}} })}><ComposicaoLocal userId="u" clienteId="cliente" localId={localId} caminho={["Área", "Local"]}/></QueryClientProvider>); }
function preparar() {
  m.from.mockImplementation((t: string) => {
    const q: Record<string, unknown> = {};
    for (const metodo of ["select", "eq", "is", "order", "range"]) q[metodo] = vi.fn(() => q);
    q.abortSignal = vi.fn(() => Promise.resolve({ data: m.rows[t] ?? [], error: m.falha === t ? new Error("indisponível") : null }));
    return q;
  });
}
afterEach(() => { vi.unstubAllEnvs(); m.autorizar.mockReset(); m.from.mockReset(); m.rows={}; m.falha=""; });
describe("composição do Local", () => {
  it("não consulta com flag desligada", () => {
    vi.stubEnv("VITE_SSO_COMPOSICAO_LOCAL_ENABLED", "false");
    montar(); expect(m.from).not.toHaveBeenCalled();
  });
  it.skipIf(import.meta.env.VITE_SSO_COMPOSICAO_LOCAL_ENABLED !== "true")("não consulta com acesso negado", async () => {
    vi.stubEnv("VITE_SSO_COMPOSICAO_LOCAL_ENABLED", "true"); m.autorizar.mockResolvedValue(false); montar();
    fireEvent.click(screen.getByRole("button", { name:"Ver composição do Local" }));
    await waitFor(() => expect(m.autorizar).toHaveBeenCalledTimes(2));
    expect(m.from).not.toHaveBeenCalled();
  });
  it.skipIf(import.meta.env.VITE_SSO_COMPOSICAO_LOCAL_ENABLED !== "true")("agrupa componente por vínculo real e mostra caminho", async () => {
    vi.stubEnv("VITE_SSO_COMPOSICAO_LOCAL_ENABLED", "true"); m.autorizar.mockResolvedValue(true); preparar();
    m.rows.equipamentos=[{id:itemId,nome:"Bomba",tipo:"componente"}];
    m.rows.sistema_itens=[{item_id:itemId,sistema_id:sistemaId,sistemas:{nome:"Hidráulico",ativo:true}}];
    montar(); fireEvent.click(screen.getByRole("button", { name:"Ver composição do Local" }));
    expect(await screen.findByText("Componente · Bomba")).toBeTruthy();
    expect(screen.getByText(`Sistema Hidráulico · ${sistemaId}`)).toBeTruthy();
    expect(screen.getByText(/Área › Local/)).toBeTruthy();
    expect(m.from).toHaveBeenCalledTimes(5);
  });
  it.skipIf(import.meta.env.VITE_SSO_COMPOSICAO_LOCAL_ENABLED !== "true")("indica falha de fonte sem afirmar ausência e permite repetir", async () => {
    vi.stubEnv("VITE_SSO_COMPOSICAO_LOCAL_ENABLED", "true"); m.autorizar.mockResolvedValue(true); preparar(); m.falha="equipamentos";
    montar(); fireEvent.click(screen.getByRole("button", { name:"Ver composição do Local" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Vínculos ausentes podem estar em outra página ou fonte indisponível");
    expect(screen.queryByText(/Nenhum ativo carregado/)).toBeNull();
    m.falha=""; fireEvent.click(await screen.findByRole("button", { name:"Tentar fontes indisponíveis" }));
    expect(await screen.findByText(/Nenhum ativo carregado/)).toBeTruthy();
  });
  it.skipIf(import.meta.env.VITE_SSO_COMPOSICAO_LOCAL_ENABLED !== "true")("identifica o item em cada controle de detalhes", async () => {
    vi.stubEnv("VITE_SSO_COMPOSICAO_LOCAL_ENABLED", "true"); m.autorizar.mockResolvedValue(true); preparar();
    m.rows.equipamentos=[{id:itemId,nome:"Bomba",tipo:"componente"},{id:"10000000-0000-4000-8000-000000000004",nome:"Válvula",tipo:"componente"}];
    montar(); fireEvent.click(screen.getByRole("button", {name:"Ver composição do Local"}));
    expect(await screen.findByRole("button", {name:"Ver detalhes do componente Bomba"})).toBeTruthy();
    expect(screen.getByRole("button", {name:"Ver detalhes do componente Válvula"})).toBeTruthy();
  });
});
