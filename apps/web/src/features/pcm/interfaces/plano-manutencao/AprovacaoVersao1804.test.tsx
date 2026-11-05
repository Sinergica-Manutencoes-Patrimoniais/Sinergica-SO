// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ preparar: vi.fn(), versao: vi.fn(), legado: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } },
}));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({
  prepararAprovacaoVersao: api.preparar,
  aprovarVersaoEsperada: api.versao,
  aprovarRevisaoPreparada: api.legado,
  supabasePlanoManutencaoAdapter: {},
}));
import { AcoesRevisaoPlano } from "./AcoesRevisaoPlano";
const clienteId = "16500000-0000-4000-8000-00000000000a";
const planoId = "16500000-0000-4000-8000-000000000011";
const versaoId = "16500000-0000-4000-8000-000000000012";
const chave = `sso-plano-revisao:usuario:${clienteId}:${planoId}`;
const recibo = (c: { requestId: string; planoId: string; expectedRevision: number }) => ({
  requestId: c.requestId,
  aggregateId: c.planoId,
  revision: c.expectedRevision + 1,
  state: "aprovado",
  created: false,
  linkedIds: { clienteId, versaoId },
  warnings: [],
});
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("VITE_SSO_APROVACAO_VERSAO_ESPERADA_ENABLED", "true");
  vi.stubEnv("VITE_SSO_APROVAR_REVISAO_ENABLED", "true");
  vi.stubEnv("VITE_SSO_PROTOCOLO_REVISAO_1731_ENABLED", "true");
  api.preparar.mockResolvedValue(versaoId);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
function montar() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <AcoesRevisaoPlano
        userId="usuario"
        clienteId={clienteId}
        plano={{ id: planoId, clienteId, nome: "Preventivo", estado: "em_revisao", revisao: 3 }}
        bloqueado={false}
      />
    </QueryClientProvider>,
  );
}
function escolher(revisao: boolean) {
  fireEvent.click(
    screen.getByRole("button", {
      name: revisao ? "Aprovar revisão de versão" : "Aprovar Preventivo",
    }),
  );
  fireEvent.change(screen.getByLabelText("Início da vigência"), {
    target: { value: "2026-11-06" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
}
it.each([false, true])(
  "captura e repete mesma versão esperada, revisão mediada=%s",
  async (revisao) => {
    api.versao.mockRejectedValueOnce(new Error("rede")).mockImplementation(async (c) => recibo(c));
    const view = montar();
    escolher(revisao);
    await screen.findByText(/Não foi possível confirmar a operação/);
    const salvo = JSON.parse(sessionStorage.getItem(chave) ?? "null");
    expect(salvo.versaoEsperada).toBe(versaoId);
    expect(api.preparar).toHaveBeenCalledWith("usuario", clienteId, planoId, 3);
    expect(api.versao.mock.calls[0]?.[1]).toEqual({
      userId: "usuario",
      clienteId,
      versaoId,
      revisaoPreparada: revisao,
    });
    view.unmount();
    vi.stubEnv("VITE_SSO_APROVACAO_VERSAO_ESPERADA_ENABLED", "false");
    montar();
    fireEvent.click(
      screen.getByRole("button", { name: /Tentar operação de Preventivo novamente/ }),
    );
    await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
    expect(api.versao.mock.calls[1]?.[0]).toEqual(api.versao.mock.calls[0]?.[0]);
    expect(api.preparar).toHaveBeenCalledTimes(1);
  },
);
it("pedido legado de revisão continua no protocolo original quando flag é ligada", async () => {
  const comando = {
    requestId: "16500000-0000-4000-8000-000000000099",
    expectedRevision: 3,
    planoId,
    vigencia: "2026-11-06",
  };
  sessionStorage.setItem(chave, JSON.stringify({ tipo: "aprovacao_revisao", comando }));
  api.legado.mockImplementation(async (c) => recibo(c));
  montar();
  fireEvent.click(screen.getByRole("button", { name: /Tentar operação de Preventivo novamente/ }));
  await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
  expect(api.legado).toHaveBeenCalledWith(comando, { userId: "usuario", clienteId });
  expect(api.versao).not.toHaveBeenCalled();
});
