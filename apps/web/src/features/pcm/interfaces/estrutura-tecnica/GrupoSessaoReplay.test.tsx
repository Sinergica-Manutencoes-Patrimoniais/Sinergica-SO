// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MoverGrupo } from "./MoverGrupo";
import { ReclassificarGrupo } from "./ReclassificarGrupo";
import { QuantidadeMotivadaGrupo } from "./QuantidadeMotivadaGrupo";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: mocks.getUser }, schema: () => ({ rpc: mocks.rpc }) },
}));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const userId = id(1),
  clienteId = id(2),
  grupoId = id(3),
  requestId = id(4);
const grupo = {
  id: grupoId,
  clienteId,
  localId: id(5),
  categoriaId: id(6),
  sistemaId: null,
  nome: "Grupo",
  quantidade: 4,
  caracteristicas: {},
  revisao: 1,
};
const base = { requestId, userId, clienteId, grupoId, revision: 1 };
const casos = [
  {
    nome: "movimentação",
    chave: "sso-mover-grupo",
    flag: "VITE_SSO_MOVER_GRUPO_ENABLED",
    botao: "Repetir movimentação",
    pedido: { ...base, localDestinoId: id(7), motivo: "Conferido" },
    recibo: { aggregateId: grupoId, requestId, revision: 2, localId: id(7) },
    componente: () => (
      <MoverGrupo userId={userId} clienteId={clienteId} grupo={grupo} locais={[]} disponivel />
    ),
  },
  {
    nome: "reclassificação",
    chave: "sso-reclassificar-grupo",
    flag: "VITE_SSO_RECLASSIFICAR_GRUPO_ENABLED",
    botao: "Repetir reclassificação",
    pedido: { ...base, categoriaId: id(8), sistemaId: null, motivo: "Conferido" },
    recibo: { aggregateId: grupoId, requestId, revision: 2, categoriaId: id(8), sistemaId: null },
    componente: () => (
      <ReclassificarGrupo
        userId={userId}
        clienteId={clienteId}
        grupo={grupo}
        categorias={[]}
        sistemas={[]}
        disponivel
      />
    ),
  },
  {
    nome: "quantidade",
    chave: "sso-quantidade-grupo",
    flag: "VITE_SSO_QUANTIDADE_MOTIVADA_GRUPO_ENABLED",
    botao: "Repetir alteração",
    pedido: { ...base, quantidade: 5, motivo: "Conferido" },
    recibo: { aggregateId: grupoId, requestId, revision: 2, quantidade: 5 },
    componente: () => (
      <QuantidadeMotivadaGrupo userId={userId} clienteId={clienteId} grupo={grupo} disponivel />
    ),
  },
];
const sessao = (idUsuario: string) => ({ data: { user: { id: idUsuario } }, error: null });
beforeEach(() => {
  sessionStorage.clear();
  mocks.getUser.mockReset();
  mocks.rpc.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
describe.each(casos)("$nome: tentativa pendente e sessão", (cenario) => {
  function montar() {
    vi.stubEnv(cenario.flag, "true");
    const chave = `${cenario.chave}:${JSON.stringify([userId, clienteId, grupoId])}`;
    const salvo = JSON.stringify(cenario.pedido);
    sessionStorage.setItem(chave, salvo);
    const query = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(<QueryClientProvider client={query}>{cenario.componente()}</QueryClientProvider>);
    return { chave, salvo };
  }
  it("preserva o pedido e não envia se a sessão mudou antes", async () => {
    mocks.getUser.mockResolvedValue(sessao(id(9)));
    const { chave, salvo } = montar();
    fireEvent.click(screen.getByRole("button", { name: cenario.botao }));
    await waitFor(() => expect(screen.getByText(/Resultado não confirmado/)).toBeTruthy());
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(chave)).toBe(salvo);
  });
  it("preserva o pedido se a sessão mudar após resposta válida", async () => {
    mocks.getUser.mockResolvedValueOnce(sessao(userId)).mockResolvedValue(sessao(id(9)));
    mocks.rpc.mockResolvedValue({ data: cenario.recibo, error: null });
    const { chave, salvo } = montar();
    fireEvent.click(screen.getByRole("button", { name: cenario.botao }));
    await waitFor(() => expect(screen.getByText(/tentativa local não foi limpa/i)).toBeTruthy());
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(chave)).toBe(salvo);
  });
  it("não envia se a tentativa muda durante a autenticação", async () => {
    const { chave } = montar();
    mocks.getUser.mockImplementation(async () => {
      sessionStorage.setItem(chave, "tentativa modificada");
      return sessao(userId);
    });
    fireEvent.click(screen.getByRole("button", { name: cenario.botao }));
    await waitFor(() => expect(screen.getByText(/Resultado não confirmado/)).toBeTruthy());
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(chave)).toBe("tentativa modificada");
  });
});
