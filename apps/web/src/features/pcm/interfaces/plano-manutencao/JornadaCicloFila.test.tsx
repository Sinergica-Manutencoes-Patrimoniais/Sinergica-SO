// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) },
    schema: () => ({ rpc: api.rpc }),
  },
}));
import { MaterializarCicloCanonico } from "./MaterializarCicloCanonico";
const id = (n: number) => `16610000-0000-4000-8000-${String(n).padStart(12, "0")}`;
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it("prepara ciclo e inclui a mesma ocorrência na fila após confirmação independente", async () => {
  vi.stubEnv("VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED", "true");
  vi.stubEnv("VITE_SSO_ORIGEM_EFETIVA_CICLO_ENABLED", "true");
  let incluida = false;
  api.rpc.mockImplementation((nome, p) => {
    if (nome === "sso_consultar_origem_efetiva_ciclo")
      return {
        abortSignal: async () => ({
          error: null,
          data: {
            planoId: id(2),
            versaoId: id(3),
            rotinaId: id(4),
            revisao: 1,
            ciclo: 2,
            vencimento: "2026-11-20",
            estado: "plano",
            agendamentoId: null,
            fontesCompletas: false,
            exclusividadeGlobalComprovada: false,
          },
        }),
      };
    if (nome === "sso_materializar_ciclo_canonico")
      return Promise.resolve({
        error: null,
        data: {
          requestId: p.p_request_id,
          indice: 2,
          vencimentoOriginal: "2026-11-20",
          criada: true,
          preparadaId: id(6),
          cicloCanonicoId: id(7),
          osCriada: false,
          tarefaAuvoCriada: false,
        },
      });
    if (nome === "sso_consultar_entrada_fila_preventiva_v2")
      return {
        abortSignal: async () => ({
          error: null,
          data: incluida
            ? [
                {
                  ciclo_id: id(7),
                  preparada_id: id(6),
                  estado: "verificacao",
                  situacao_atual: "conferida",
                  revisao: 1,
                  vencimento: "2026-11-20",
                  atualizado_em: "2026-11-04T12:00:00Z",
                },
              ]
            : [],
        }),
      };
    if (nome === "sso_alterar_fila_preventiva_pcm") {
      incluida = true;
      return Promise.resolve({
        error: null,
        data: {
          requestId: p.p_request_id,
          clienteId: p.p_cliente_id,
          planoId: p.p_plano_id,
          preparadaId: p.p_preparada_id,
          cicloId: id(7),
          estado: "verificacao",
          revision: 1,
          osCriada: false,
          tarefaAuvoCriada: false,
        },
      });
    }
    throw new Error(`RPC inesperada: ${nome}`);
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MaterializarCicloCanonico
        userId="usuario"
        clienteId={id(1)}
        planoId={id(2)}
        versaoId={id(3)}
        rotinaId={id(4)}
        revision={1}
        ciclo={2}
        vencimento="2026-11-20"
      />
    </QueryClientProvider>,
  );
  await screen.findByText(/Origem Plano declarada/);
  fireEvent.click(screen.getByRole("checkbox", { name: /conferi ciclo/i }));
  fireEvent.click(screen.getByRole("button", { name: "Preparar ciclo" }));
  await screen.findByText(`Ocorrência preparada ${id(6)}.`);
  expect(
    api.rpc.mock.calls.filter(([nome]) => nome === "sso_alterar_fila_preventiva_pcm"),
  ).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Conferir fila" }));
  const fila = screen.getByRole("region", { name: "Fila preventiva local" });
  await within(fila).findByText(/Nenhuma entrada registrada/);
  fireEvent.change(within(fila).getByLabelText("Motivo"), {
    target: { value: "Conferido pelo PCM" },
  });
  fireEvent.click(within(fila).getByRole("checkbox", { name: /conferi a ocorrência/i }));
  fireEvent.click(within(fila).getByRole("button", { name: "Incluir na fila local" }));
  await within(fila).findByText(/Ciclo incluído para conferência/);
  await waitFor(() => expect(within(fila).getByText(/Entrada verificacao/)).toBeInTheDocument());
  expect(api.rpc).toHaveBeenCalledWith(
    "sso_alterar_fila_preventiva_pcm",
    expect.objectContaining({ p_preparada_id: id(6), p_acao: "incluir", p_expected_revision: 0 }),
  );
});

it.each(["primeira", "replay"] as const)(
  "trata conflito P0011 na %s tentativa de geração",
  async (etapa) => {
    let chamadas = 0;
    api.rpc.mockImplementation(() =>
      Promise.resolve({
        data: null,
        error:
          etapa === "replay" && chamadas++ === 0
            ? new Error("rede")
            : { code: "P0011", message: "revisao_obsoleta" },
      }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MaterializarCicloCanonico
          userId="usuario"
          clienteId={id(1)}
          planoId={id(2)}
          versaoId={id(3)}
          rotinaId={id(4)}
          revision={1}
          ciclo={2}
          vencimento="2026-11-20"
        />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /conferi ciclo/i }));
    fireEvent.click(screen.getByRole("button", { name: "Preparar ciclo" }));
    if (etapa === "primeira") {
      await screen.findByText(/A revisão mudou/);
      expect(sessionStorage.length).toBe(0);
    } else {
      await screen.findByText(/Resultado não confirmado/);
      fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
      await waitFor(() => expect(api.rpc).toHaveBeenCalledTimes(2));
      expect(sessionStorage.length).toBe(1);
    }
  },
);
