// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FotosStagingAtivo } from "./FotosStagingAtivo";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: mocks.rpc }), functions: { invoke: mocks.invoke }, auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
const id = "10000000-0000-4000-8000-000000000001";
function montar(tipo: "componente" | "equipamento" = "componente") {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FotosStagingAtivo userId="u" clienteId="c" tipo={tipo} entidadeId={id}/></QueryClientProvider>);
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); mocks.rpc.mockReset(); mocks.invoke.mockReset(); });
describe("fotos privadas do ativo", () => {
  it("não consulta quando a flag está desligada", () => {
    vi.stubEnv("VITE_SSO_FOTOS_STAGING_ATIVO_ENABLED", "false"); montar();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("consulta pelo mediador e abre somente pelo endpoint privado", async () => {
    vi.stubEnv("VITE_SSO_FOTOS_STAGING_ATIVO_ENABLED", "true");
    mocks.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [{ id, criado_em: "2026-01-01T00:00:00+00:00" }], error: null }) });
    mocks.invoke.mockResolvedValue({ data: new Blob(["foto"], { type: "image/png" }), error: null });
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:foto"), revokeObjectURL: vi.fn() }));
    montar(); fireEvent.click(await screen.findByRole("button", { name: "Ver foto" }));
    expect(mocks.rpc).toHaveBeenCalledWith("sso_listar_fotos_staging_ativo_mediado", { p_tipo: "componente", p_entidade_id: id, p_apos: null, p_limite: 20 });
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("pcm-foto-staging-ativo-segura", { body: { vinculoId: id } }));
    expect(await screen.findByAltText("Foto aceita do levantamento")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar foto" }));
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:foto"));
  });
  it("recusa resposta não suportada do endpoint", async () => {
    vi.stubEnv("VITE_SSO_FOTOS_STAGING_ATIVO_ENABLED", "true");
    mocks.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [{ id, criado_em: "2026-01-01T00:00:00+00:00" }], error: null }) });
    mocks.invoke.mockResolvedValue({ data: new Blob(["x"], { type: "text/html" }), error: null });
    montar(); fireEvent.click(await screen.findByRole("button", { name: "Ver foto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Foto indisponível ou acesso não autorizado");
  });
  it("informa erro de acesso sem tentar baixar e permite repetir a consulta", async () => {
    vi.stubEnv("VITE_SSO_FOTOS_STAGING_ATIVO_ENABLED", "true");
    mocks.rpc.mockReturnValueOnce({ abortSignal: () => Promise.resolve({ data: null, error: new Error("negado") }) });
    mocks.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [], error: null }) });
    montar(); expect(await screen.findByRole("alert")).toHaveTextContent("Fotos indisponíveis");
    expect(mocks.invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
  it("desabilita abertura enquanto download mediado está pendente", async () => {
    vi.stubEnv("VITE_SSO_FOTOS_STAGING_ATIVO_ENABLED", "true");
    mocks.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [{ id, criado_em: "2026-01-01T00:00:00+00:00" }], error: null }) });
    let concluir!: (value: unknown) => void;
    mocks.invoke.mockReturnValue(new Promise(resolve => { concluir=resolve; }));
    montar(); const botao=await screen.findByRole("button", { name: "Ver foto" });
    fireEvent.click(botao); expect(botao).toBeDisabled(); fireEvent.click(botao);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    concluir({ data: null, error: new Error("negado") });
    expect(await screen.findByRole("alert")).toHaveTextContent("Foto indisponível ou acesso não autorizado");
  });
  it("exige flag específica para consultar fotos de Equipamento", () => {
    vi.stubEnv("VITE_SSO_FOTOS_STAGING_ATIVO_ENABLED", "true"); vi.stubEnv("VITE_SSO_FOTOS_EQUIPAMENTO_ENABLED", "false");
    montar("equipamento"); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("usa mediadores versionados privados para Equipamento", async () => {
    vi.stubEnv("VITE_SSO_FOTOS_STAGING_ATIVO_ENABLED", "true"); vi.stubEnv("VITE_SSO_FOTOS_EQUIPAMENTO_ENABLED", "true");
    mocks.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [{ id, criado_em: "2026-01-01T00:00:00+00:00" }], error: null }) });
    mocks.invoke.mockResolvedValue({ data: new Blob(["foto"], { type: "image/png" }), error: null });
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:equipamento"), revokeObjectURL: vi.fn() }));
    montar("equipamento"); fireEvent.click(await screen.findByRole("button", { name: "Ver foto" }));
    expect(mocks.rpc).toHaveBeenCalledWith("sso_listar_fotos_staging_ativo_mediado_v2", { p_tipo:"equipamento",p_entidade_id:id,p_apos:null,p_limite:20 });
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("pcm-foto-equipamento-segura",{body:{vinculoId:id}}));
  });
});
