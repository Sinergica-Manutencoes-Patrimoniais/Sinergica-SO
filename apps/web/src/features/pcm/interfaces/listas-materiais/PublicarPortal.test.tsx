// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: mocks.getUser }, schema: () => ({ rpc: mocks.rpc }) } }));
import { PublicarPortal } from "./PublicarPortal";

const props = { usuario: "usuario", cliente: "cliente", ordemServico: "os", listaId: "a0000000-0000-4000-8000-000000000001", revisao: 1 };
function montar() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><PublicarPortal {...props} /></QueryClientProvider>); }
beforeEach(() => { sessionStorage.clear(); vi.stubEnv("VITE_SSO_PUBLICAR_MATERIAIS_PORTAL_ENABLED", "true"); vi.stubEnv("VITE_SSO_PUBLICAR_MATERIAIS_MEDIADO_ENABLED", "true"); mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "usuario" } }, error: null }); mocks.rpc.mockReset().mockImplementation(async (_nome, p) => ({ data: { aggregateId: p.p_lista_id, requestId: p.p_request_id, revision: p.p_expected_revision }, error: null })); });
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); });

it("exige nova revisão após mudar quantidade e publica somente os campos públicos", async () => {
  montar();
  fireEvent.change(screen.getByLabelText("Linhas públicas"), { target: { value: "Filtro" } });
  fireEvent.click(screen.getByLabelText(/Revisei cada linha/));
  fireEvent.change(screen.getByLabelText("Quantidade da linha 1"), { target: { value: "2" } });
  expect(screen.getByRole("button", { name: "Publicar versão" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Unidade da linha 1"), { target: { value: "un" } });
  fireEvent.click(screen.getByLabelText(/Revisei cada linha/));
  fireEvent.click(screen.getByRole("button", { name: "Publicar versão" }));
  await screen.findByText("Versão pública publicada para o Cliente.");
  expect(mocks.rpc).toHaveBeenCalledWith("sso_portal_publicar_materiais_mediada", expect.objectContaining({ p_cliente_id: "cliente", p_os_id: "os", p_linhas: [{ descricao: "Filtro", quantidade: "2", unidade: "un" }] }));
});

it("preserva a tentativa e não publica se a sessão mudou", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "outro" } }, error: null }); montar();
  fireEvent.change(screen.getByLabelText("Linhas públicas"), { target: { value: "Filtro" } });
  fireEvent.click(screen.getByLabelText(/Revisei cada linha/));
  fireEvent.click(screen.getByRole("button", { name: "Publicar versão" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Resultado não confirmado"));
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(1);
});

it("mantém quantidades em descrições únicas ao reordenar e limpa duplicadas", () => {
  montar();
  fireEvent.change(screen.getByLabelText("Linhas públicas"), { target: { value: "Filtro\nMotor" } });
  fireEvent.change(screen.getByLabelText("Quantidade da linha 1"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Linhas públicas"), { target: { value: "Motor\nFiltro" } });
  expect(screen.getByLabelText("Quantidade da linha 2")).toHaveValue("2");
  fireEvent.change(screen.getByLabelText("Linhas públicas"), { target: { value: "Filtro\nFiltro" } });
  expect(screen.getByLabelText("Quantidade da linha 1")).toHaveValue("");
  expect(screen.getByLabelText("Quantidade da linha 2")).toHaveValue("");
});
