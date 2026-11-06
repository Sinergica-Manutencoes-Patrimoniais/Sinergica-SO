// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExportarFila } from "./ExportarFila";

const api = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), autorizar: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) } }));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({ supabaseCapacidadesSsoAdapter: { autorizarAcao: api.autorizar } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });

it("não baixa dados depois que o usuário sai do contexto", async () => {
  let devolver!: (value: unknown) => void;
  api.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
  api.autorizar.mockResolvedValue(true);
  api.rpc.mockReturnValue(new Promise((resolve) => { devolver = resolve; }));
  const criar = vi.fn(() => "blob:teste");
  const URLOriginal = URL;
  vi.stubGlobal("URL", class extends URLOriginal { static override createObjectURL = criar; static override revokeObjectURL = vi.fn(); });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const tela = render(<ExportarFila userId="u" clienteId="c" estado="" />);
  fireEvent.click(screen.getByRole("button", { name: /Exportar primeira página/ }));
  await waitFor(() => expect(devolver).toBeTypeOf("function"));
  tela.unmount();
  await act(async () => devolver({ data: [], error: null }));
  expect(criar).not.toHaveBeenCalled();
});

it("não baixa exportação iniciada para filtro anterior", async () => {
  let devolver!: (value: unknown) => void;
  api.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
  api.autorizar.mockResolvedValue(true);
  api.rpc.mockReturnValue(new Promise((resolve) => { devolver = resolve; }));
  const criar = vi.fn(() => "blob:teste");
  const URLOriginal = URL;
  vi.stubGlobal("URL", class extends URLOriginal { static override createObjectURL = criar; static override revokeObjectURL = vi.fn(); });
  const tela = render(<ExportarFila userId="u" clienteId="c" estado="pending" />);
  fireEvent.click(screen.getByRole("button", { name: /Exportar primeira página/ }));
  await waitFor(() => expect(devolver).toBeTypeOf("function"));
  tela.rerender(<ExportarFila userId="u" clienteId="c" estado="error" />);
  await act(async () => devolver({ data: [], error: null }));
  expect(criar).not.toHaveBeenCalled();
});

it("permite exportação quando contexto e autorização permanecem válidos", async () => {
  api.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
  api.autorizar.mockResolvedValue(true);
  api.rpc.mockResolvedValue({ data: [], error: null });
  const criar = vi.fn(() => "blob:teste");
  const URLOriginal = URL;
  vi.stubGlobal("URL", class extends URLOriginal { static override createObjectURL = criar; static override revokeObjectURL = vi.fn(); });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<ExportarFila userId="u" clienteId="c" estado="" />);
  fireEvent.click(screen.getByRole("button", { name: /Exportar primeira página/ }));
  expect(await screen.findByText(/Exportados 0 itens/)).toBeTruthy();
  expect(criar).toHaveBeenCalledTimes(1);
});
