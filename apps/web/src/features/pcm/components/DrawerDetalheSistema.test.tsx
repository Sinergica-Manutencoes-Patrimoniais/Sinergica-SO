// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  CadastroSistema,
  ComponenteSistema,
  OsSistema,
  PreventivaSistema,
} from "../domain/detalhe-sistema";

const gateway = vi.hoisted(() => ({
  obterCadastro: vi.fn(),
  listarComponentes: vi.fn(),
  listarOs: vi.fn(),
  listarPreventivas: vi.fn(),
}));

vi.mock("../infrastructure/supabase-detalhe-sistema-adapter", () => ({
  supabaseDetalheSistemaAdapter: gateway,
}));
vi.mock("./DrawerDetalheAtivo", () => ({
  DrawerDetalheAtivo: () => <div>Detalhe do componente</div>,
}));

import { DrawerDetalheSistema } from "./DrawerDetalheSistema";

const cadastro: CadastroSistema = {
  id: "s-1",
  clienteId: "c-1",
  nome: "Sistema de incêndio",
  identificador: "CLI-PCI-01",
  clienteNome: "Cliente A",
  categoria: "PCI",
  descricao: null,
  posicao: "Torre A > Térreo",
  syncStatus: "synced",
  criadoEm: "2026-10-01T10:00:00Z",
  atualizadoEm: null,
  quantidadeComponentes: 1,
};
const componentes: ComponenteSistema[] = [
  { id: "cmp-1", nome: "Bomba", identificador: "BOM-01", posicao: "Garagem" },
];
const ordens: OsSistema[] = [
  {
    id: "os-aberta",
    numero: "CH-10",
    titulo: "Verificar bomba",
    status: "planejamento",
    prioridade: "alta",
    tecnicoNome: "Ana",
    dataAgendada: "2026-10-10T10:00:00Z",
    concluidaEm: null,
    atualizadaEm: null,
    auvoTaskId: 10,
    origens: [{ tipo: "sistema", nome: "Sistema de incêndio" }],
  },
  {
    id: "os-final",
    numero: "CH-09",
    titulo: "Teste",
    status: "finalizado",
    prioridade: null,
    tecnicoNome: "Bia",
    dataAgendada: "2026-09-01T10:00:00Z",
    concluidaEm: "2026-09-02T10:00:00Z",
    atualizadaEm: null,
    auvoTaskId: null,
    origens: [{ tipo: "componente", id: "cmp-1", nome: "Bomba" }],
  },
];
const preventivas: PreventivaSistema[] = [];

function renderDrawer(
  onClose = vi.fn(),
  onAbrirOs = vi.fn(),
  preventivasDoTeste: PreventivaSistema[] = preventivas,
) {
  gateway.obterCadastro.mockResolvedValue(cadastro);
  gateway.listarComponentes.mockResolvedValue(componentes);
  gateway.listarOs.mockResolvedValue(ordens);
  gateway.listarPreventivas.mockResolvedValue(preventivasDoTeste);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onClose,
    onAbrirOs,
    ...render(
      <QueryClientProvider client={queryClient}>
        <DrawerDetalheSistema
          sistemaId="s-1"
          clienteEsperadoId="c-1"
          onClose={onClose}
          onAbrirOs={onAbrirOs}
        />
      </QueryClientProvider>,
    ),
  };
}

describe("DrawerDetalheSistema — E01-S162", () => {
  it("separa abertas, histórico e usa somente execução concluída como última manutenção", async () => {
    renderDrawer();
    expect(await screen.findByText("CH-10 · Verificar bomba")).toBeInTheDocument();
    expect(screen.getByText("CH-09 · Teste")).toBeInTheDocument();
    expect(screen.getByText(/Última manutenção:/)).toHaveTextContent("02/09/2026");
    expect(
      screen.getByText("Nenhuma preventiva vinculada ao Sistema ou aos componentes atuais."),
    ).toBeInTheDocument();
  });

  it("fecha por Escape e abre a OS no PCM", async () => {
    const { onClose, onAbrirOs } = renderDrawer();
    await screen.findByText("Sistema de incêndio");
    await userEvent.click(await screen.findByRole("button", { name: /CH-10 · Verificar bomba/ }));
    expect(onAbrirOs).toHaveBeenCalledWith("os-aberta");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("mantém o Sistema aberto quando Escape pertence ao detalhe de um componente sobreposto", async () => {
    const { onClose } = renderDrawer();
    await userEvent.click(await screen.findByRole("button", { name: /Bomba/ }));
    expect(screen.getByText("Detalhe do componente")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });

  it("não oferece link Auvo quando a ocorrência tem identificador remoto inválido", async () => {
    renderDrawer(vi.fn(), vi.fn(), [
      {
        id: "plano-1",
        plano: "Preventiva da bomba",
        alvo: "Bomba",
        planoPausado: false,
        periodicidade: "1 meses",
        proximoVencimento: "2026-10-15",
        ocorrencias: [
          {
            id: "ocorrencia-1",
            vencimento: "2026-10-15",
            visitaEm: null,
            estado: "disponivel",
            resultado: "pendente",
            concluidaEm: null,
            tecnicoNome: null,
            osId: null,
            osNumero: null,
            auvoTaskId: -1,
          },
        ],
      },
    ]);

    expect(await screen.findByText("Preventiva da bomba")).toBeInTheDocument();
    expect(screen.queryByText("Ver OS no Auvo")).not.toBeInTheDocument();
  });
});
