// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InspecoesPage } from "./InspecoesPage";

vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));
vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "usuario" } }) }));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({
    carregando: false,
    podeAcessar: (_modulo: string, acesso: string) => acesso === "leitura",
  }),
}));
vi.mock("../infrastructure/supabase-qualidade-adapter", () => ({
  supabaseQualidadeAdapter: {
    listarClientes: async () => [{ id: "cliente", nome: "Condomínio fictício" }],
    listarInspecoes: async () => [
      {
        id: "inspecao",
        titulo: "Ensaio fictício",
        clienteNome: "Condomínio fictício",
        dataInspecao: "2026-11-25",
        status: "em_andamento",
        totalItens: 4,
        itensNaoConformes: 1,
        itensAtencao: 0,
      },
    ],
    listarTiposInspecao: async () => [],
    listarTemplates: async () => [],
    listarItensInspecao: async () =>
      ["nao_avaliado", "nao_avaliado", "nao_aplicavel", "nao_conforme"].map((resultado, i) => ({
        id: String(i),
        descricao: `Ocorrência fictícia ${i + 1}`,
        sistema: "geral",
        destino: null,
        gravidade: null,
        urgencia: null,
        tendencia: null,
        esforcoHoras: null,
        resultado,
      })),
  },
}));

afterEach(cleanup);

it("separa os itens não avaliados dos não aplicáveis no resumo da inspeção", async () => {
  render(<InspecoesPage />);
  await screen.findByText("Ocorrência fictícia 1");
  expect(screen.queryByText("N/A")).toBeNull();
  expect(
    screen.getByText("Não avaliado", { selector: "div" }).previousElementSibling,
  ).toHaveTextContent(/^2$/);
  expect(
    screen.getByText("Não aplicável", { selector: "div" }).previousElementSibling,
  ).toHaveTextContent(/^1$/);
  expect(screen.getByText("Total").previousElementSibling).toHaveTextContent(/^4$/);
});
