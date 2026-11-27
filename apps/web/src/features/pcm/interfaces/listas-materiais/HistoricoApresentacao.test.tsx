// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DisponibilidadeMateriais } from "./DisponibilidadeMateriais";

const ator = "6d411746-594c-4e21-b9a2-e1c50f035ac0";
const criadoEm = "2026-11-26T19:33:24.746648+00:00";

vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "u" } } }) } },
}));
vi.mock("../../infrastructure/supabase-listas-materiais-adapter", () => ({
  supabaseListasMateriaisAdapter: {
    listarEventos: async () => [
      {
        revisao: 2,
        tipo: "aquisicao",
        ator_id: ator,
        criado_em: criadoEm,
        dados: {},
      },
    ],
  },
  validarInformarMaterial: (valor: unknown) => valor,
}));
vi.mock("./DetalheEvento", () => ({ DetalheEvento: () => null }));

it("mostra rótulo e horário local no histórico sem exibir o UUID", async () => {
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <DisponibilidadeMateriais usuario="u" cliente="c" ordemServico="os" listaId="l" revisao={2} />
    </QueryClientProvider>,
  );
  const item = await screen.findByText(/Revisão 2 · Aquisição/);
  expect(item).toHaveTextContent("Nome do responsável indisponível");
  expect(item).not.toHaveTextContent(ator);
  const horario = container.querySelector("time");
  expect(horario).toHaveAttribute("datetime", criadoEm);
  expect(horario).toHaveTextContent(
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(criadoEm),
    ),
  );
});

it("mantém eventos visíveis sem formulário ou retry de alteração na lista concluída", async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DisponibilidadeMateriais
        usuario="u"
        cliente="c"
        ordemServico="os"
        listaId="l"
        revisao={2}
        somenteLeitura
      />
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/Revisão 2 · Aquisição/)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /Registrar informação|Tentar informar novamente/ }),
  ).not.toBeInTheDocument();
});
