// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AprovarPlanoCommand } from "../../application/plano-manutencao-gateway";

const api = vi.hoisted(() => ({ aprovar: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } },
}));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({
  aprovarRevisaoPreparada: api.aprovar,
  supabasePlanoManutencaoAdapter: {},
}));
import { AcoesRevisaoPlano } from "./AcoesRevisaoPlano";

const clienteId = "16500000-0000-4000-8000-00000000000a";
const planoId = "16500000-0000-4000-8000-000000000011";
const versaoId = "16500000-0000-4000-8000-000000000012";
const outroId = "16500000-0000-4000-8000-000000000013";
const chave = `sso-plano-revisao:usuario:${clienteId}:${planoId}`;
const recibo = (c: AprovarPlanoCommand) => ({
  requestId: c.requestId,
  aggregateId: c.planoId,
  revision: c.expectedRevision + 1,
  state: "aprovado",
  created: false,
  linkedIds: { clienteId, versaoId },
  warnings: [],
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

function iniciar() {
  vi.stubEnv("VITE_SSO_APROVAR_REVISAO_ENABLED", "true");
  vi.stubEnv("VITE_SSO_PROTOCOLO_REVISAO_1731_ENABLED", "true");
  render(
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
  fireEvent.click(screen.getByRole("button", { name: "Aprovar revisão de versão" }));
  fireEvent.change(screen.getByLabelText("Início da vigência"), {
    target: { value: "2026-11-06" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
}

it.each(["pedido", "plano", "estado", "revisao", "cliente", "versao"] as const)(
  "preserva aprovação quando o recibo diverge em %s e repete o mesmo pedido",
  async (campo) => {
    api.aprovar
      .mockImplementationOnce(async (c: AprovarPlanoCommand) => {
        const r = recibo(c);
        if (campo === "pedido") r.requestId = outroId;
        if (campo === "plano") r.aggregateId = outroId;
        if (campo === "estado") r.state = "em_revisao";
        if (campo === "revisao") r.revision += 1;
        if (campo === "cliente") r.linkedIds.clienteId = outroId;
        if (campo === "versao") r.linkedIds.versaoId = "inválida";
        return r;
      })
      .mockImplementation(async (c: AprovarPlanoCommand) => recibo(c));
    iniciar();
    await screen.findByText(/Não foi possível confirmar a operação/);
    const pendente = sessionStorage.getItem(chave);
    expect(pendente).not.toBeNull();
    const primeira = api.aprovar.mock.calls[0];
    if (!primeira) throw new Error("Aprovação não foi enviada");
    fireEvent.click(
      screen.getByRole("button", { name: /Tentar operação de Preventivo novamente/ }),
    );
    await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
    expect(api.aprovar).toHaveBeenCalledTimes(2);
    const repeticao = api.aprovar.mock.calls[1];
    if (!repeticao) throw new Error("Repetição não foi enviada");
    expect(repeticao[0]).toEqual(primeira[0]);
  },
);
