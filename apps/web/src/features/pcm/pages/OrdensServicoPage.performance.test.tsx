// @vitest-environment jsdom

import { TooltipProvider } from "@sinergica/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ItemOperacaoResumo,
  OperacaoGateway,
  PaginaOperacao,
} from "../application/operacao-gateway";
import {
  dadosFeedParaOrdens,
  operacaoQueryKeys,
  useAlterarStatusOperacao,
  useDetalheOperacao,
  useFeedOperacao,
  useFeedsKanban,
  useKpisOperacao,
} from "../application/operacao-queries";

import { OsKanbanView } from "../components/OsKanbanView";
import { COLUNAS_KANBAN_PADRAO } from "../domain/kanban-colunas";

const mocks = vi.hoisted(() => ({
  listarPagina: vi.fn(),
  obterDetalhe: vi.fn(),
  contarKpis: vi.fn(),
  alterarStatusLote: vi.fn(),
}));

const gateway = mocks as unknown as OperacaoGateway;

function item(id: string, titulo: string): ItemOperacaoResumo {
  return {
    id,
    tipo: "ordem_servico",
    ordemServicoId: id,
    chamadoId: null,
    clienteId: "cliente",
    clienteNome: "Cliente",
    numero: `CH-${id}`,
    titulo,
    categoria: "corretiva",
    origem: "manual",
    status: "solicitacao",
    prioridade: "normal",
    gravidade: null,
    urgencia: null,
    tendencia: null,
    dorCliente: null,
    scorePcm: 0,
    origemInspecaoItemId: null,
    auvoTaskId: null,
    auvoSyncStatus: null,
    auvoSyncError: null,
    createdAt: "2026-08-10T12:00:00Z",
    tecnicoFuncionarioId: null,
    tecnicoNome: null,
    dataAgendada: null,
    checkInAt: null,
    checkOutAt: null,
    tipoOs: null,
    pmocScheduleId: null,
    orientacao: null,
    ocorrenciaPreventivaId: null,
  };
}

function pagina(...itens: ItemOperacaoResumo[]): PaginaOperacao {
  return { itens, proximoCursor: null, total: itens.length };
}

function Wrapper({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function Feed({ busca }: { busca: string }) {
  const query = useFeedOperacao(gateway, {
    busca,
    ordem: "recentes",
    limite: 50,
    status: "ativos",
  });
  const ordens = dadosFeedParaOrdens(query.data?.pages);
  return (
    <div>
      <span>{ordens.map((ordem) => ordem.titulo).join(",")}</span>
      {query.isFetching && <i>atualizando</i>}
    </div>
  );
}

function FeedPorCliente({ clienteId, kanban }: { clienteId: string; kanban: boolean }) {
  const filtro = { clienteId, status: "ativos" as const };
  const lista = useFeedOperacao(gateway, { ...filtro, ordem: "recentes", limite: 50 }, !kanban);
  const quadro = useFeedsKanban(gateway, filtro, kanban);
  const kpis = useKpisOperacao(gateway, { clienteId });
  const feed = kanban ? quadro : { ...lista, pages: lista.data?.pages };
  return (
    <>
      {kpis.data && <p>Total {kpis.data.total}</p>}
      {dadosFeedParaOrdens(feed.pages).map((ordem) => (
        <p key={ordem.id}>{ordem.titulo}</p>
      ))}
      {feed.hasNextPage && (
        <button type="button" onClick={() => void feed.fetchNextPage()}>
          Mais
        </button>
      )}
    </>
  );
}

function QuadroMovel() {
  const quadro = useFeedsKanban(gateway, { status: "ativos" });
  const movimento = useAlterarStatusOperacao(gateway);
  return (
    <TooltipProvider>
      <OsKanbanView
        ordens={dadosFeedParaOrdens(quadro.pages)}
        temEscrita
        salvando={movimento.isPending}
        onAlterarStatus={(id, status) => movimento.mutate({ ids: [id], status })}
        onSelecionar={() => {}}
        colunas={COLUNAS_KANBAN_PADRAO}
        onMoverColuna={() => {}}
        onAlternarVisibilidadeColuna={() => {}}
        preventivas={[]}
      />
    </TooltipProvider>
  );
}

function colunaKanban(rotulo: string) {
  const coluna = screen.getByRole("button", { name: `Ocultar coluna ${rotulo}` }).parentElement
    ?.parentElement?.parentElement;
  if (!coluna) throw new Error(`Coluna ${rotulo} não encontrada`);
  return within(coluna);
}

function Detalhe({ id }: { id: string | null }) {
  const query = useDetalheOperacao(gateway, id);
  return <span>{query.data?.descricao ?? "sem detalhe"}</span>;
}

function BotaoStatus({ ids = ["1"] }: { ids?: string[] }) {
  const mutacao = useAlterarStatusOperacao(gateway);
  return (
    <button type="button" onClick={() => mutacao.mutate({ ids, status: "planejamento" })}>
      alterar
    </button>
  );
}

describe("fluidez do feed de Chamados", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reconsulta Validação PCM e Execução após persistir os dois movimentos e carrega Demanda", async () => {
    let status = "em_execucao";
    mocks.listarPagina.mockImplementation(async ({ status: fase }) =>
      fase === status
        ? pagina({ ...item("1", "OS fictícia"), status })
        : fase === "demanda"
          ? pagina({
              ...item("chamado-aberto:2", "Chamado fictício"),
              tipo: "chamado_aberto",
              ordemServicoId: null,
              status: "demanda",
            })
          : pagina(),
    );
    mocks.alterarStatusLote.mockImplementation(async (_ids, destino) => {
      status = destino;
      return [{ id: "1", sucesso: true, erro: null }];
    });
    render(<QuadroMovel />, { wrapper: Wrapper });
    await colunaKanban("Em execução").findByText("OS fictícia");
    const seletorDaOs = (coluna: string) =>
      colunaKanban(coluna).getByRole("combobox", { name: /Mover .* para outra fase/ });
    fireEvent.change(seletorDaOs("Em execução"), { target: { value: "validacao_pcm" } });
    await waitFor(() => expect(seletorDaOs("Validação PCM")).toBeEnabled());
    expect(colunaKanban("Validação PCM").getByText("OS fictícia")).toBeTruthy();
    expect(screen.getAllByText("OS fictícia")).toHaveLength(1);
    expect(
      mocks.listarPagina.mock.calls.filter(([filtro]) => filtro.status === "validacao_pcm"),
    ).toHaveLength(2);
    fireEvent.change(seletorDaOs("Validação PCM"), { target: { value: "em_execucao" } });
    await waitFor(() => expect(seletorDaOs("Em execução")).toBeEnabled());
    expect(colunaKanban("Em execução").getByText("OS fictícia")).toBeTruthy();
    expect(colunaKanban("Validação PCM").queryByText("OS fictícia")).toBeNull();
    expect(colunaKanban("Demanda").getByText("Chamado fictício")).toBeTruthy();
    expect(seletorDaOs("Demanda")).toHaveValue("demanda");
    expect(screen.getAllByText("OS fictícia")).toHaveLength(1);
  });

  it.each([false, true])("isola páginas e cursor ao trocar Cliente (kanban %s)", async (kanban) => {
    let resolverB!: (pagina: PaginaOperacao) => void;
    mocks.contarKpis.mockImplementation(({ clienteId }) =>
      clienteId === "a" ? Promise.resolve({ total: 11 }) : new Promise(() => {}),
    );
    mocks.listarPagina.mockImplementation(({ clienteId, status, cursor }) => {
      if (kanban && status !== "solicitacao") return Promise.resolve(pagina());
      if (clienteId === "a")
        return Promise.resolve({
          ...pagina({ ...item("1", "OS de A"), clienteId }),
          proximoCursor: { ordem: "recentes", createdAt: "2026-08-10T12:00:00Z", id: "1" },
        });
      if (cursor) return Promise.resolve(pagina({ ...item("3", "Segunda de B"), clienteId }));
      return new Promise<PaginaOperacao>((resolve) => {
        resolverB = resolve;
      });
    });
    const view = render(<FeedPorCliente clienteId="a" kanban={kanban} />, { wrapper: Wrapper });
    await screen.findByText("OS de A");
    await screen.findByText("Total 11");
    expect(screen.getByRole("button", { name: "Mais" })).toBeTruthy();
    view.rerender(<FeedPorCliente clienteId="b" kanban={kanban} />);
    expect(screen.queryByText("OS de A")).toBeNull();
    expect(screen.queryByText("Total 11")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mais" })).toBeNull();
    await act(async () =>
      resolverB({
        ...pagina({ ...item("2", "OS de B"), clienteId: "b" }),
        proximoCursor: { ordem: "recentes", createdAt: "2026-08-10T12:00:00Z", id: "2" },
      }),
    );
    await screen.findByText("OS de B");
    fireEvent.click(screen.getByRole("button", { name: "Mais" }));
    await screen.findByText("Segunda de B");
    expect(mocks.listarPagina).toHaveBeenLastCalledWith(
      expect.objectContaining({ clienteId: "b", cursor: expect.objectContaining({ id: "2" }) }),
      expect.any(AbortSignal),
    );
  });

  it("mantém o identificador de Cliente de cada OS para filtrar o backlog", () => {
    const primeira = item("1", "Inspeção");
    const segunda = { ...item("2", "Vistoria"), clienteId: "outro-cliente" };
    const ordens = dadosFeedParaOrdens([pagina(primeira, segunda)]);
    expect(ordens.map((ordem) => ordem.clienteId)).toEqual(["cliente", "outro-cliente"]);
  });

  it("mantém dados anteriores durante troca de filtro", async () => {
    let resolverNova: ((value: PaginaOperacao) => void) | undefined;
    mocks.listarPagina.mockImplementation(({ busca }: { busca: string }) => {
      if (busca === "nova") {
        return new Promise<PaginaOperacao>((resolve) => {
          resolverNova = resolve;
        });
      }
      return Promise.resolve(pagina(item("1", "Anterior")));
    });
    const view = render(<Feed busca="antiga" />, { wrapper: Wrapper });
    await screen.findByText("Anterior");

    view.rerender(<Feed busca="nova" />);
    expect(screen.getByText("Anterior")).toBeInTheDocument();
    expect(screen.getByText("atualizando")).toBeInTheDocument();

    await act(async () => resolverNova?.(pagina(item("2", "Nova"))));
    await screen.findByText("Nova");
  });

  it("cancela a busca anterior e somente a última vence", async () => {
    const resolvers = new Map<string, (value: PaginaOperacao) => void>();
    const abortadas: string[] = [];
    mocks.listarPagina.mockImplementation(
      ({ busca }: { busca: string }, signal: AbortSignal | undefined) =>
        new Promise<PaginaOperacao>((resolve, reject) => {
          resolvers.set(busca, resolve);
          signal?.addEventListener("abort", () => {
            abortadas.push(busca);
            reject(new DOMException("Abortada", "AbortError"));
          });
        }),
    );
    const view = render(<Feed busca="primeira" />, { wrapper: Wrapper });
    view.rerender(<Feed busca="ultima" />);

    await waitFor(() => expect(abortadas).toContain("primeira"));
    await act(async () => resolvers.get("ultima")?.(pagina(item("2", "Resultado novo"))));
    await screen.findByText("Resultado novo");
    await act(async () => resolvers.get("primeira")?.(pagina(item("1", "Resultado antigo"))));
    expect(screen.queryByText("Resultado antigo")).not.toBeInTheDocument();
  });

  it("não carrega detalhe antes de selecionar um item", async () => {
    mocks.obterDetalhe.mockResolvedValue({
      descricao: "Detalhe lazy",
      observacao: null,
      detalhes: null,
      localDescricao: null,
      solicitante: null,
      origem: "manual",
    });
    const view = render(<Detalhe id={null} />, { wrapper: Wrapper });
    expect(mocks.obterDetalhe).not.toHaveBeenCalled();

    view.rerender(<Detalhe id="1" />);
    await screen.findByText("Detalhe lazy");
    expect(mocks.obterDetalhe).toHaveBeenCalledTimes(1);
  });

  it("aplica status otimista e reverte quando a mutação falha", async () => {
    let rejeitar: ((error: Error) => void) | undefined;
    mocks.alterarStatusLote.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejeitar = reject;
        }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const consulta = { ordem: "recentes" as const, limite: 50, status: "ativos" as const };
    const key = operacaoQueryKeys.feed(consulta);
    client.setQueryData(key, { pages: [pagina(item("1", "OS"))], pageParams: [null] });

    render(
      <QueryClientProvider client={client}>
        <BotaoStatus />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "alterar" }));
    await waitFor(() => {
      const data = client.getQueryData<{ pages: PaginaOperacao[] }>(key);
      expect(data?.pages[0]?.itens[0]?.status).toBe("planejamento");
    });

    await act(async () => rejeitar?.(new Error("falhou")));
    await waitFor(() => {
      const data = client.getQueryData<{ pages: PaginaOperacao[] }>(key);
      expect(data?.pages[0]?.itens[0]?.status).toBe("solicitacao");
    });
  });

  it("mantém sucesso e reverte somente a falha do lote parcial", async () => {
    mocks.alterarStatusLote.mockResolvedValue([
      { id: "1", sucesso: true, erro: null },
      { id: "2", sucesso: false, erro: "sem permissão" },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const consulta = { ordem: "recentes" as const, limite: 50, status: "ativos" as const };
    const key = operacaoQueryKeys.feed(consulta);
    client.setQueryData(key, {
      pages: [pagina(item("1", "OS 1"), item("2", "OS 2"))],
      pageParams: [null],
    });

    render(
      <QueryClientProvider client={client}>
        <BotaoStatus ids={["1", "2"]} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "alterar" }));

    await waitFor(() => {
      const data = client.getQueryData<{ pages: PaginaOperacao[] }>(key);
      expect(data?.pages[0]?.itens.map((registro) => registro.status)).toEqual([
        "planejamento",
        "solicitacao",
      ]);
    });
  });
});
