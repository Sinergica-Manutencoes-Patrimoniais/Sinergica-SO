// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
} from "../application/operacao-queries";

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
