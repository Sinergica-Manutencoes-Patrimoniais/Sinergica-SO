// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    auth: { getUser: api.getUser },
    schema: () => ({ rpc: api.rpc }),
    functions: { invoke: api.invoke },
  },
}));
import { FotosGrupo } from "./FotosGrupo";

const userId = "10000000-0000-4000-8000-000000000001";
const clienteId = "10000000-0000-4000-8000-000000000002";
const grupoId = "10000000-0000-4000-8000-000000000003";
const fotoId = "10000000-0000-4000-8000-000000000004";
const user = () => ({ data: { user: { id: userId } }, error: null });
function tela() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FotosGrupo userId={userId} clienteId={clienteId} grupoId={grupoId} podeEditar={false} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.stubEnv("VITE_SSO_FOTOS_GRUPO_ENABLED", "true");
  api.getUser.mockResolvedValue(user());
  api.rpc.mockReturnValue({
    abortSignal: async () => ({
      data: [{ id: fotoId, criado_em: "2026-11-05T12:00:00Z", verificada: true }],
      error: null,
    }),
  });
  api.invoke.mockResolvedValue({
    data: new Blob(["foto"], { type: "image/png" }),
    error: null,
    response: new Response(null, { headers: { "X-SSO-Foto-Verificacao": "sha256" } }),
  });
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL: vi.fn(() => "blob:teste"),
      revokeObjectURL: vi.fn(),
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it("lista por RPC mediada e abre a foto cadastral, revogando a URL ao ocultar", async () => {
  tela();
  fireEvent.click(await screen.findByRole("button", { name: "Ver foto" }));
  expect(await screen.findByRole("img", { name: "Foto do Grupo Quantitativo" })).toBeTruthy();
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_fotos_cadastrais_grupo_v2", {
    p_ator: userId,
    p_cliente: clienteId,
    p_grupo: grupoId,
    p_apos: null,
    p_limite: 20,
  });
  expect(api.invoke).toHaveBeenCalledWith("pcm-foto-cadastral-grupo-segura", {
    body: { clienteId, grupoId, fotoId },
  });
  expect(api.invoke).not.toHaveBeenCalledWith("pcm-foto-grupo-segura", expect.anything());
  fireEvent.click(screen.getByRole("button", { name: "Ocultar foto" }));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:teste");
});

it("não exibe foto quando a sessão muda após a resposta", async () => {
  tela();
  const botao = await screen.findByRole("button", { name: "Ver foto" });
  api.getUser
    .mockResolvedValueOnce(user())
    .mockResolvedValueOnce({ data: { user: { id: clienteId } }, error: null });
  fireEvent.click(botao);
  expect(await screen.findByRole("alert")).toHaveTextContent("Foto indisponível");
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it("não cria URL se a tela for desmontada antes da resposta", async () => {
  let responder: (valor: { data: Blob; error: null; response: Response }) => void = () => {};
  api.invoke.mockReturnValue(
    new Promise((resolve) => {
      responder = resolve;
    }),
  );
  const vista = tela();
  fireEvent.click(await screen.findByRole("button", { name: "Ver foto" }));
  await waitFor(() => expect(api.invoke).toHaveBeenCalledOnce());
  vista.unmount();
  responder({
    data: new Blob(["foto"], { type: "image/png" }),
    error: null,
    response: new Response(null, { headers: { "X-SSO-Foto-Verificacao": "sha256" } }),
  });
  await waitFor(() => expect(api.getUser).toHaveBeenCalledTimes(4));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it.each([null, "historica-sem-digest"])(
  "rejeita cabeçalho ausente ou divergente: %s",
  async (cabecalho) => {
    api.invoke.mockResolvedValue({
      data: new Blob(["foto"], { type: "image/png" }),
      error: null,
      response: new Response(null, {
        headers: cabecalho ? { "X-SSO-Foto-Verificacao": cabecalho } : {},
      }),
    });
    tela();
    fireEvent.click(await screen.findByRole("button", { name: "Ver foto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Foto indisponível");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  },
);

it("abre foto histórica apenas com cabeçalho correspondente e revoga ao desmontar", async () => {
  api.rpc.mockReturnValue({
    abortSignal: async () => ({
      data: [{ id: fotoId, criado_em: "2026-11-05T12:00:00Z", verificada: false }],
      error: null,
    }),
  });
  api.invoke.mockResolvedValue({
    data: new Blob(["foto"], { type: "image/png" }),
    error: null,
    response: new Response(null, { headers: { "X-SSO-Foto-Verificacao": "historica-sem-digest" } }),
  });
  const vista = tela();
  expect(await screen.findByText("Foto histórica sem verificação de integridade.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Ver foto" }));
  expect(await screen.findByRole("img", { name: "Foto do Grupo Quantitativo" })).toBeTruthy();
  vista.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:teste");
});
