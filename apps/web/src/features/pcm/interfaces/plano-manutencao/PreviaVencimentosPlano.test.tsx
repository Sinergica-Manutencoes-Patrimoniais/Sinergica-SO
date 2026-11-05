// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ ler: vi.fn(), confirmar: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } },
}));
vi.mock("../../application/snapshot-exportacao", () => ({
  lerSnapshotExportacao: api.ler,
  confirmarSnapshotExportacao: api.confirmar,
}));
vi.mock("../../infrastructure/supabase-snapshot-exportacao", () => ({
  obterPaginaSnapshotExportacao: vi.fn(),
}));
vi.mock("./DecidirVencimento", () => ({
  DecidirVencimento: ({ ciclo, vencimento }: { ciclo: number; vencimento: string }) => (
    <p>
      Decisão do ciclo {ciclo} em {vencimento}
    </p>
  ),
}));
vi.mock("./TriagemCicloAtrasado", () => ({ TriagemCicloAtrasado: () => null }));
import { PreviaVencimentosPlano } from "./PreviaVencimentosPlano";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("projeta ciclos anteriores à referência e oferece decisão sem criar ocorrência", async () => {
  vi.stubEnv("VITE_SSO_DECISAO_VENCIMENTO_ENABLED", "true");
  api.ler.mockResolvedValue({
    total: 2,
    versaoNumero: 1,
    vigenciaInicio: "2026-01-01",
    vigenciaFim: null,
    rotinas: [
      {
        id: "r1",
        nome: "Extintores",
        alvoNome: "Torre A",
        alvoId: "a1",
        alvoTipo: "sistema",
        modo: "calendario",
        intervalo: 1,
        unidade: "meses",
        dataBase: "2026-01-15",
        toleranciaAntes: 0,
        toleranciaDepois: 0,
      },
      {
        id: "r2",
        nome: "Atendimento semanal",
        alvoNome: "Torre B",
        alvoId: "a2",
        alvoTipo: "sistema",
        modo: "visita",
        intervalo: 1,
        unidade: "semanas",
        dataBase: null,
      },
    ],
  });
  api.confirmar.mockResolvedValue(undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PreviaVencimentosPlano userId="u" clienteId="c" planoId="p" versaoId="v" revisaoPlano={3} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Início da conferência"), {
    target: { value: "2026-01-01" },
  });
  fireEvent.change(screen.getByLabelText("Data de referência"), {
    target: { value: "2026-03-15" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Consultar vencimentos anteriores" }));
  expect(await screen.findByText(/2 vencimento\(s\) anterior/)).toBeTruthy();
  expect(screen.getByText(/1 Rotina\(s\) por Visita não projetada/)).toBeTruthy();
  const botoes = screen.getAllByRole("button", { name: "Conferir este ciclo" });
  expect(botoes).toHaveLength(2);
  fireEvent.click(botoes[0]!);
  expect(screen.getByText("Decisão do ciclo 0 em 2026-01-15")).toBeTruthy();
  expect(api.confirmar).toHaveBeenCalledTimes(1);
});

it("não projeta quando a versão não informa início de vigência", async () => {
  api.ler.mockResolvedValue({
    total: 0,
    versaoNumero: 1,
    vigenciaInicio: null,
    vigenciaFim: null,
    rotinas: [],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PreviaVencimentosPlano userId="u" clienteId="c" planoId="p" versaoId="v" revisaoPlano={3} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Início da conferência"), {
    target: { value: "2026-01-01" },
  });
  fireEvent.change(screen.getByLabelText("Data de referência"), {
    target: { value: "2026-03-15" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Consultar vencimentos anteriores" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/prévia indisponível/i);
  expect(api.confirmar).not.toHaveBeenCalled();
});
