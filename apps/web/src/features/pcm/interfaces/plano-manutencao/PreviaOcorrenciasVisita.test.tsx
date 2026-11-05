// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const externo = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: externo.getUser }, schema: () => ({ rpc: externo.rpc }) },
}));
vi.mock("./OrigemGeracaoRotina", () => ({ OrigemGeracaoRotina: () => null }));
vi.mock("./ConferenciaPmocCiclo", () => ({ ConferenciaPmocCiclo: () => null }));
vi.mock("./LoteOcorrenciasVisita", () => ({ LoteOcorrenciasVisita: () => null }));
vi.mock("./FilaPreventivaPcm", () => ({
  FilaPreventivaPcm: ({ preparadaId, tipo }: { preparadaId: string; tipo: string }) => (
    <p>
      Fila {tipo}: {preparadaId}
    </p>
  ),
}));
import { PreviaOcorrenciasVisita } from "./PreviaOcorrenciasVisita";
const id = (n: string) => `16610000-0000-4000-8000-${n.padStart(12, "0")}`;
beforeEach(() => {
  vi.stubEnv("VITE_SSO_MATERIALIZAR_VISITA_CANONICA_ENABLED", "true");
  vi.stubEnv("VITE_SSO_FILA_VISITA_ENABLED", "true");
  externo.getUser.mockResolvedValue({ data: { user: { id: "usuario" } }, error: null });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  sessionStorage.clear();
});

it("mantém o pedido anterior quando o recibo não é encontrado", async () => {
  vi.stubEnv("VITE_SSO_RECIBO_PREPARACAO_VISITA_ENABLED", "true");
  const chave = `sso-preparar-ocorrencia-visita:${JSON.stringify(["usuario", id("4"), id("5"), id("7"), id("8")])}`;
  const pedido = JSON.stringify({
    requestId: id("10"),
    ocorrenciaId: id("11"),
    clienteId: id("4"),
    planoId: id("5"),
    versaoId: id("6"),
    rotinaId: id("7"),
    visitaId: id("1"),
    revision: 1,
    fonte: "PCM",
    modo: "anterior",
  });
  sessionStorage.setItem(chave, pedido);
  externo.rpc.mockResolvedValue({ data: { encontrado: false }, error: null });
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <PreviaOcorrenciasVisita
        userId="usuario"
        clienteId={id("4")}
        planoId={id("5")}
        versaoId={id("6")}
        rotinaId={id("7")}
        serieId={id("8")}
        revision={1}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Consultar recibo anterior" }));
  await screen.findByText(/situação ainda é indeterminada/);
  expect(sessionStorage.getItem(chave)).toBe(pedido);
  expect(
    externo.rpc.mock.calls.some(
      ([nome]) =>
        nome === "sso_preparar_visita_canonica" || nome === "sso_preparar_ocorrencia_por_visita",
    ),
  ).toBe(false);
});

it.each(["valido", "invalido"] as const)(
  "trata recibo anterior %s sem gerar novamente",
  async (cenario) => {
    vi.stubEnv("VITE_SSO_RECIBO_PREPARACAO_VISITA_ENABLED", "true");
    const chave = `sso-preparar-ocorrencia-visita:${JSON.stringify(["usuario", id("4"), id("5"), id("7"), id("8")])}`;
    const pedido = JSON.stringify({
      requestId: id("10"),
      ocorrenciaId: id("11"),
      clienteId: id("4"),
      planoId: id("5"),
      versaoId: id("6"),
      rotinaId: id("7"),
      visitaId: id("1"),
      revision: 1,
      fonte: "PCM",
      modo: "anterior",
    });
    sessionStorage.setItem(chave, pedido);
    // O núcleo pode reutilizar uma ocorrência distinta da solicitada.
    externo.rpc.mockResolvedValue({
      data: {
        encontrado: true,
        resultado: {
          requestId: id("10"),
          ocorrenciaId: id("12"),
          visitaId: cenario === "valido" ? id("1") : id("13"),
          preparada: true,
        },
      },
      error: null,
    });
    const query = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidar = vi.spyOn(query, "invalidateQueries");
    render(
      <QueryClientProvider client={query}>
        <PreviaOcorrenciasVisita
          userId="usuario"
          clienteId={id("4")}
          planoId={id("5")}
          versaoId={id("6")}
          rotinaId={id("7")}
          serieId={id("8")}
          revision={1}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Consultar recibo anterior" }));
    if (cenario === "valido") {
      await screen.findByText(/Recibo anterior confirmado/);
      expect(sessionStorage.getItem(chave)).toBeNull();
      await waitFor(() => {
        for (const prefixo of [
          "previa-ocorrencia-visita",
          "obrigacoes-preparadas",
          "ciclos-uniformes",
          "reserva-futuro-visitas",
          "reserva-futuro",
        ]) {
          expect(invalidar).toHaveBeenCalledWith({
            queryKey: [prefixo, "usuario", id("4"), id("5")],
          });
        }
      });
    } else {
      await screen.findByText(/Não foi possível conferir o recibo/);
      expect(sessionStorage.getItem(chave)).toBe(pedido);
      expect(invalidar).not.toHaveBeenCalled();
    }
    expect(
      externo.rpc.mock.calls.some(
        ([nome]) =>
          nome === "sso_preparar_visita_canonica" || nome === "sso_preparar_ocorrencia_por_visita",
      ),
    ).toBe(false);
  },
);

it("reconsulta o mesmo período e exige nova conferência após atualização", async () => {
  let chamadas = 0;
  externo.rpc.mockImplementation(() => ({
    abortSignal: async () => ({
      data: [
        {
          visita_id: id("1"),
          semana_origem: "2026-11-02",
          vencimento_original: "2026-11-06",
          estado_visita: "planejada",
          feriado_declarado: ++chamadas > 1,
          vigencia_declarada: true,
          ocorrencia_preparada: false,
        },
      ],
      error: null,
    }),
  }));
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PreviaOcorrenciasVisita
        userId="usuario"
        clienteId={id("4")}
        planoId={id("5")}
        versaoId={id("6")}
        rotinaId={id("7")}
        serieId={id("8")}
        revision={1}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-11-30" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar Visitas" }));
  fireEvent.click(await screen.findByRole("button", { name: "Conferir preparação" }));
  fireEvent.click(screen.getByRole("button", { name: "Consultar Visitas" }));
  await screen.findByText(/feriado declarado/);
  expect(chamadas).toBe(2);
  expect(screen.queryByRole("button", { name: "Conferir preparação" })).toBeNull();
});

it("encaminha o recibo de preparação individual para a fila, sem incluí-lo automaticamente", async () => {
  externo.rpc.mockImplementation((nome, p) =>
    nome === "sso_prever_visitas_rotina"
      ? {
          abortSignal: async () => ({
            data: [
              {
                visita_id: id("1"),
                semana_origem: "2026-11-02",
                vencimento_original: "2026-11-06",
                estado_visita: "planejada",
                feriado_declarado: false,
                vigencia_declarada: true,
                ocorrencia_preparada: false,
              },
            ],
            error: null,
          }),
        }
      : Promise.resolve({
          data: {
            requestId: p.p_request_id,
            visitaId: p.p_visita_id,
            ocorrenciaId: id("2"),
            cicloVisitaId: id("3"),
            osCriada: false,
            tarefaAuvoCriada: false,
          },
          error: null,
        }),
  );
  const query = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={query}>
      <PreviaOcorrenciasVisita
        userId="usuario"
        clienteId={id("4")}
        planoId={id("5")}
        versaoId={id("6")}
        rotinaId={id("7")}
        serieId={id("8")}
        revision={1}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-11-30" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar Visitas" }));
  fireEvent.click(await screen.findByRole("button", { name: "Conferir preparação" }));
  fireEvent.change(screen.getByLabelText("Fonte consultada para declarar dia sem feriado"), {
    target: { value: "Calendário PCM" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /confirmei visita/i }));
  fireEvent.click(screen.getByRole("button", { name: "Preparar ocorrência sem envio" }));
  fireEvent.click(await screen.findByRole("button", { name: "Conferir inclusão na fila" }));
  expect(screen.getByText(`Fila visita: ${id("2")}`)).toBeInTheDocument();
  expect(
    externo.rpc.mock.calls.filter(([nome]) => nome === "sso_alterar_fila_visita"),
  ).toHaveLength(0);
});

it.each(["visita_candidata_alterada", "serialization failure"])(
  "preserva pedido individual e payload após 40001: %s",
  async (mensagem) => {
    externo.rpc.mockImplementation((nome) =>
      nome === "sso_prever_visitas_rotina"
        ? {
            abortSignal: async () => ({
              data: [
                {
                  visita_id: id("1"),
                  semana_origem: "2026-11-02",
                  vencimento_original: "2026-11-06",
                  estado_visita: "planejada",
                  feriado_declarado: false,
                  vigencia_declarada: true,
                  ocorrencia_preparada: false,
                },
              ],
              error: null,
            }),
          }
        : Promise.resolve({ data: null, error: { code: "40001", message: mensagem } }),
    );
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <PreviaOcorrenciasVisita
          userId="usuario"
          clienteId={id("4")}
          planoId={id("5")}
          versaoId={id("6")}
          rotinaId={id("7")}
          serieId={id("8")}
          revision={1}
        />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-11-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Consultar Visitas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Conferir preparação" }));
    fireEvent.change(screen.getByLabelText("Fonte consultada para declarar dia sem feriado"), {
      target: { value: "PCM" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /confirmei visita/i }));
    fireEvent.click(screen.getByRole("button", { name: "Preparar ocorrência sem envio" }));
    const repetir = await screen.findByRole("button", { name: "Repetir mesmo pedido" });
    await waitFor(() => expect((repetir as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(repetir);
    await waitFor(() =>
      expect(
        externo.rpc.mock.calls.filter(([nome]) => nome === "sso_preparar_visita_canonica"),
      ).toHaveLength(2),
    );
    const chamadas = externo.rpc.mock.calls.filter(
      ([nome]) => nome === "sso_preparar_visita_canonica",
    );
    expect(chamadas[1]?.[1]).toEqual(chamadas[0]?.[1]);
    expect(sessionStorage.length).toBe(1);
  },
);

it.each([
  ["primeira", "P0016", "revisao_ou_plano_indisponivel"],
  ["replay", "P0016", "revisao_ou_plano_indisponivel"],
  ["primeira", "P0020", "visita_candidata_alterada"],
  ["replay", "P0020", "visita_candidata_alterada"],
] as const)("trata revisão obsoleta na %s tentativa", async (cenario, codigo, mensagem) => {
  let chamadas = 0;
  externo.rpc.mockImplementation((nome) =>
    nome === "sso_prever_visitas_rotina"
      ? {
          abortSignal: async () => ({
            data: [
              {
                visita_id: id("1"),
                semana_origem: "2026-11-02",
                vencimento_original: "2026-11-06",
                estado_visita: "planejada",
                feriado_declarado: false,
                vigencia_declarada: true,
                ocorrencia_preparada: false,
              },
            ],
            error: null,
          }),
        }
      : Promise.resolve({
          data: null,
          error:
            cenario === "replay" && chamadas++ === 0
              ? new Error("rede")
              : { code: codigo, message: mensagem },
        }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <PreviaOcorrenciasVisita
        userId="usuario"
        clienteId={id("4")}
        planoId={id("5")}
        versaoId={id("6")}
        rotinaId={id("7")}
        serieId={id("8")}
        revision={1}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-11-30" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar Visitas" }));
  fireEvent.click(await screen.findByRole("button", { name: "Conferir preparação" }));
  fireEvent.change(screen.getByLabelText("Fonte consultada para declarar dia sem feriado"), {
    target: { value: "PCM" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /confirmei visita/i }));
  fireEvent.click(screen.getByRole("button", { name: "Preparar ocorrência sem envio" }));
  if (cenario === "primeira") {
    await screen.findByText(/A revisão ou a Visita selecionada mudou/);
    expect(sessionStorage.length).toBe(0);
  } else {
    fireEvent.click(await screen.findByRole("button", { name: "Repetir mesmo pedido" }));
    await screen.findByText(/Resultado não confirmado/);
    expect(sessionStorage.length).toBe(1);
  }
});
