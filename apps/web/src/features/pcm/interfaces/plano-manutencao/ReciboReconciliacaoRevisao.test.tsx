// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) },
}));
import { ReciboReconciliacaoRevisao } from "./ReciboReconciliacaoRevisao";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("mostra mudanças, OS comprovada e bloqueio por fontes desconhecidas no mesmo recibo", async () => {
  api.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
  api.rpc.mockReturnValue({
    abortSignal: async () => ({
      error: null,
      data: {
        revision: 7,
        versaoAnteriorId: "16584000-0000-4000-8000-000000000001",
        versaoRascunhoId: "16584000-0000-4000-8000-000000000002",
        nextCursor: null,
        limite: 20,
        ocorrencias: [{
          chave: "calendario:16584000-0000-4000-8000-000000000003",
          modo: "calendario",
          ocorrenciaId: "16584000-0000-4000-8000-000000000003",
          rotinaLogicaId: "16584000-0000-4000-8000-000000000004",
          rotinaAnteriorId: "16584000-0000-4000-8000-000000000005",
          alvoAnterior: { tipo: "sistema", id: "16584000-0000-4000-8000-000000000006" },
          alvoNovo: { tipo: "sistema", id: "16584000-0000-4000-8000-000000000006" },
          ciclo: 2,
          semanaOrigem: "2026-11-01",
          vencimentoOriginal: "2026-11-01",
          novoVencimento: "2026-11-08",
          estadoQuestionario: "sem_questionario",
          classificacao: "alterar",
          ponteLegadaComprovada: true,
          ocorrenciaLegadaId: "16584000-0000-4000-8000-000000000007",
          osAbertasComPonteComprovada: [{ osId: "16584000-0000-4000-8000-000000000008", status: "em_execucao", atualizadaEm: "2026-11-01T10:00:00Z" }],
          fontesDesconhecidas: true,
          osClienteDivergente: false,
        }],
        ocorrenciasObservadas: 1,
        aManter: 0,
        aAlterar: 1,
        aRetirar: 0,
        indeterminadas: 0,
        comFontesDesconhecidas: 1,
        osAbertasComPonteComprovada: 1,
        osClienteDivergente: 0,
        visitasSemPonteLegada: null,
        planosLegadosSemRelacaoDeclarada: null,
        legadasSemPonteObservada: null,
        fontesIncompletas: true,
        impactoIntegralComprovado: false,
        confirmacaoBloqueada: true,
        motivosBloqueio: ["impacto_integral_nao_comprovado", "fontes_sem_ponte_ou_nao_mapeadas"],
        aprovacaoAutorizada: false,
      },
    }),
  });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><ReciboReconciliacaoRevisao userId="u" clienteId="c" planoId="p" revisao={7} vigencia="2026-11-01" /></QueryClientProvider>);
  expect(await screen.findByText(/Confirmação bloqueada:/)).toBeTruthy();
  expect(screen.getByText(/fontes desconhecidas 1/)).toBeTruthy();
  expect(screen.getByText(/OS aberta 16584000-0000-4000-8000-000000000008/)).toBeTruthy();
  expect(screen.getByText(/impacto desconhecido: ponte ou identidade ausente/)).toBeTruthy();
});

it("remove o bloqueio transitório de paginação somente após carregar o recibo inteiro", async () => {
  api.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
  const uuid = (n: number) => `16584000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
  const ocorrencia = (n: number) => ({
    chave: `calendario:${uuid(n)}`,
    modo: "calendario",
    ocorrenciaId: uuid(n),
    rotinaLogicaId: uuid(100),
    rotinaAnteriorId: uuid(101),
    alvoAnterior: { tipo: "sistema", id: uuid(102) },
    alvoNovo: { tipo: "sistema", id: uuid(102) },
    ciclo: n,
    semanaOrigem: "2026-11-01",
    vencimentoOriginal: "2026-11-01",
    novoVencimento: "2026-11-01",
    estadoQuestionario: "sem_questionario",
    classificacao: "manter",
    ponteLegadaComprovada: true,
    ocorrenciaLegadaId: uuid(n + 200),
    osAbertasComPonteComprovada: [],
    fontesDesconhecidas: false,
    osClienteDivergente: false,
  });
  const pagina = (ocorrencias: ReturnType<typeof ocorrencia>[], nextCursor: string | null, bloqueado: boolean) => ({
    revision: 7,
    versaoAnteriorId: "16584000-0000-4000-8000-000000000001",
    versaoRascunhoId: "16584000-0000-4000-8000-000000000002",
    nextCursor,
    limite: 20,
    ocorrencias,
    ocorrenciasObservadas: 21,
    aManter: 21,
    aAlterar: 0,
    aRetirar: 0,
    indeterminadas: 0,
    comFontesDesconhecidas: 0,
    osAbertasComPonteComprovada: 0,
    osClienteDivergente: 0,
    visitasSemPonteLegada: 0,
    planosLegadosSemRelacaoDeclarada: 0,
    legadasSemPonteObservada: 0,
    fontesIncompletas: bloqueado,
    impactoIntegralComprovado: !bloqueado,
    confirmacaoBloqueada: bloqueado,
    motivosBloqueio: bloqueado ? ["recibo_paginado_incompleto"] : [],
    aprovacaoAutorizada: false,
  });
  const primeira = pagina(Array.from({ length: 20 }, (_, i) => ocorrencia(i + 1)), "calendario:" + uuid(20), true);
  const ultima = pagina([ocorrencia(21)], null, false);
  api.rpc.mockImplementation((_function: string, args: { p_apos: string | null }) => ({
    abortSignal: async () => ({ error: null, data: args.p_apos === null ? primeira : ultima }),
  }));
  const onEstadoChange = vi.fn();
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={query}>
      <ReciboReconciliacaoRevisao userId="u" clienteId="c" planoId="p" revisao={7} vigencia="2026-11-01" onEstadoChange={onEstadoChange} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/Confirmação bloqueada: recibo_paginado_incompleto/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mais ocorrências" }));
  await waitFor(() => expect(onEstadoChange).toHaveBeenLastCalledWith("liberado"));
  expect(screen.getByText(/Reconciliação integral carregada/)).toBeTruthy();
});
