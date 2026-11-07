// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EntradaOrdensChamado, OrdensDoChamado } from "./OrdensDoChamado";

const resumo = vi.hoisted(() => vi.fn());
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } },
}));
vi.mock("../../application/resumos-chamados-lote", () => ({ carregarResumosChamados: resumo }));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); resumo.mockReset(); });
it("mostra Em andamento para OS finalizada e cancelada em etapas diferentes", async () => {
  const listar = vi.fn().mockResolvedValue([
    { id: "1", numero: "OS-1", titulo: "Concluída", status: "finalizado" },
    { id: "2", numero: "OS-2", titulo: "Cancelada", status: "cancelado" },
  ]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <OrdensDoChamado usuario="u" cliente="c" chamado="h" leitura={{ listar }} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/1 de 2 OS finalizadas · Em andamento/)).toBeTruthy();
  expect(screen.getByText(/OS-1 · Concluída · finalizado/)).toBeTruthy();
  expect(screen.getByText(/OS-2 · Cancelada · cancelado/)).toBeTruthy();
});
it("mantém a identidade própria de cada OS de um mesmo Chamado", async () => {
  const listar = vi.fn().mockResolvedValue([
    { id: "os-a", numero: "CH-0041-OS-a", titulo: "Quadro", status: "finalizado" },
    { id: "os-b", numero: "CH-0041-OS-b", titulo: "Extintor", status: "em_execucao" },
  ]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><OrdensDoChamado usuario="u" cliente="c" chamado="h" leitura={{ listar }} /></QueryClientProvider>);
  expect(await screen.findByText(/CH-0041-OS-a · Quadro · finalizado/)).toBeTruthy();
  expect(screen.getByText(/CH-0041-OS-b · Extintor · em_execucao/)).toBeTruthy();
  expect(screen.getByText(/1 de 2 OS finalizadas · Em andamento/)).toBeTruthy();
});
it("abre a OS selecionada sem confundir duas ordens do mesmo Chamado", async () => {
  const listar = vi.fn().mockResolvedValue([
    { id: "os-a", numero: "CH-0041-OS-a", titulo: "Quadro", status: "finalizado" },
    { id: "os-b", numero: "CH-0041-OS-b", titulo: "Extintor", status: "em_execucao" },
  ]);
  const onAbrirOs = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><OrdensDoChamado usuario="u" cliente="c" chamado="h" leitura={{ listar }} onAbrirOs={onAbrirOs} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Abrir OS CH-0041-OS-b" }));
  expect(onAbrirOs).toHaveBeenCalledExactlyOnceWith("os-b");
});
it("não afirma contagem integral quando a leitura precisou de várias páginas", async () => {
  const primeira = Array.from({ length: 20 }, (_, i) => ({ id: String(i).padStart(2, "0"), numero: `OS-${i}`, titulo: "Primeira página", status: "finalizado" }));
  const listar = vi.fn().mockResolvedValueOnce(primeira).mockResolvedValueOnce([{ id: "30", numero: "OS-30", titulo: "Segunda página", status: "em_execucao" }]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><OrdensDoChamado usuario="u" cliente="c" chamado="h" leitura={{ listar }} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Carregar mais Ordens de Serviço" }));
  expect(await screen.findByText(/Segunda página/)).toBeTruthy();
  expect(screen.queryByText(/20 de 21 OS finalizadas/)).toBeNull();
  expect(screen.getByText(/contagem integral indisponível/)).toBeTruthy();
});
it("consulta fotografia única em lote para exibir resumo de lista paginada", async () => {
  vi.stubEnv("VITE_SSO_RESUMO_CHAMADOS_ENABLED", "true");
  const primeira = Array.from({ length: 20 }, (_, i) => ({ id: String(i).padStart(2, "0"), numero: `OS-${i}`, titulo: "Primeira página", status: "finalizado" }));
  const listar = vi.fn().mockResolvedValueOnce(primeira).mockResolvedValueOnce([{ id: "30", numero: "OS-30", titulo: "Segunda página", status: "em_execucao" }]);
  resumo.mockResolvedValue({ h: { total: 22, finalizadas: 20, etapasMistas: true } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><OrdensDoChamado usuario="u" cliente="c" chamado="h" leitura={{ listar }} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Carregar mais Ordens de Serviço" }));
  expect(await screen.findByText(/20 de 22 OS finalizadas · Em andamento/)).toBeTruthy();
  expect(resumo).toHaveBeenCalledWith(["h"], expect.any(AbortSignal));
});
it("oculta contagem paginada quando a fotografia autorizada falha", async () => {
  vi.stubEnv("VITE_SSO_RESUMO_CHAMADOS_ENABLED", "true");
  const primeira = Array.from({ length: 20 }, (_, i) => ({ id: String(i).padStart(2, "0"), numero: `OS-${i}`, titulo: "Primeira página", status: "finalizado" }));
  const listar = vi.fn().mockResolvedValueOnce(primeira).mockResolvedValueOnce([{ id: "30", numero: "OS-30", titulo: "Segunda página", status: "em_execucao" }]);
  resumo.mockRejectedValue(new Error("sem acesso"));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><OrdensDoChamado usuario="u" cliente="c" chamado="h" leitura={{ listar }} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Carregar mais Ordens de Serviço" }));
  expect(await screen.findByText(/contagem integral indisponível/)).toBeTruthy();
  expect(screen.queryByText(/20 de 21 OS finalizadas/)).toBeNull();
});
it("não consulta com flag desligada", () => {
  const listar = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EntradaOrdensChamado
        habilitado={undefined}
        usuario="u"
        cliente="c"
        chamado="h"
        chamadoEsperado="h"
        leitura={{ listar }}
      />
    </QueryClientProvider>,
  );
  expect(listar).not.toHaveBeenCalled();
});
it("não consulta com detalhe do Chamado anterior ainda carregado", () => {
  const listar = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EntradaOrdensChamado
        habilitado="true"
        usuario="u"
        cliente="a"
        chamado="antigo"
        chamadoEsperado="novo"
        leitura={{ listar }}
      />
    </QueryClientProvider>,
  );
  expect(listar).not.toHaveBeenCalled();
});
it("oculta OS anteriores durante reconsulta e após revogação", async () => {
  const listar = vi
    .fn()
    .mockResolvedValueOnce([{ id: "os-a", numero: "OS-A", titulo: "Cliente A", status: "aberta" }]);
  let recusar!: (erro: Error) => void;
  listar.mockReturnValueOnce(
    new Promise((_, reject) => {
      recusar = reject;
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <OrdensDoChamado usuario="u" cliente="a" chamado="h" leitura={{ listar }} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/Cliente A/)).toBeTruthy();
  void client.invalidateQueries({ queryKey: ["ordens-chamado", "u", "a", "h"] });
  await waitFor(() => expect(screen.queryByText(/Cliente A/)).toBeNull());
  await act(async () => recusar(new Error("acesso revogado")));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
  expect(screen.queryByText(/Cliente A/)).toBeNull();
});
it("cancela consulta antiga e não mistura OS de outro Cliente", async () => {
  let resolver!: (dados: { id: string; numero: string; titulo: string; status: string }[]) => void;
  const listar = vi.fn(
    (
      _cliente: string,
      _chamado: string,
      _limite: number,
      _apos: string | null,
      _signal?: AbortSignal,
    ) =>
      new Promise<{ id: string; numero: string; titulo: string; status: string }[]>((resolve) => {
        resolver = resolve;
      }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const montar = (cliente: string) => (
    <QueryClientProvider client={client}>
      <OrdensDoChamado usuario="u" cliente={cliente} chamado="h" leitura={{ listar }} />
    </QueryClientProvider>
  );
  const view = render(montar("a"));
  await waitFor(() => expect(listar).toHaveBeenCalledTimes(1));
  const resolverA = resolver;
  const sinalA = listar.mock.calls[0]?.[4];
  view.rerender(montar("b"));
  await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
  expect(sinalA?.aborted).toBe(true);
  await act(async () =>
    resolver([{ id: "b", numero: "OS-B", titulo: "Cliente B", status: "aberta" }]),
  );
  expect(await screen.findByText(/Cliente B/)).toBeTruthy();
  await act(async () =>
    resolverA([{ id: "a", numero: "OS-A", titulo: "Cliente A", status: "aberta" }]),
  );
  expect(screen.queryByText(/Cliente A/)).toBeNull();
});
it("reconsulta após RPC ausente sem recorrer à leitura legada", async () => {
  const listar = vi.fn().mockRejectedValueOnce(new Error("RPC ausente")).mockResolvedValueOnce([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EntradaOrdensChamado
        habilitado="true"
        usuario="u"
        cliente="c"
        chamado="h"
        chamadoEsperado="h"
        leitura={{ listar }}
      />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("Nenhuma Ordem de Serviço vinculada.");
  expect(listar).toHaveBeenCalledTimes(2);
});
