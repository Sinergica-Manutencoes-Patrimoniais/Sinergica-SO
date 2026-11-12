// @vitest-environment jsdom
// SSO-013 (migration 1843) — os 3 estados do §8.2 que faltavam têm caminho na UI.
//
// O gap não era só de banco: mesmo com o `check` alargado, se o formulário não oferecesse a ação,
// o Fabrício abriria a tela e não acharia como dispensar ou concluir uma lista. Estes testes
// travam exatamente o que ele vai clicar — a opção existe e o comando sai com o payload que o
// banco aceita.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DisponibilidadeMateriais } from "./DisponibilidadeMateriais";

const api = vi.hoisted(() => ({ informar: vi.fn(), listarEventos: vi.fn() }));
const auth = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth } }));
vi.mock("../../infrastructure/supabase-listas-materiais-adapter", () => ({
  supabaseListasMateriaisAdapter: api,
  validarInformarMaterial: (valor: unknown) => valor,
}));
vi.mock("./EvidenciasExcecao", () => ({ EvidenciasExcecao: () => null }));
vi.mock("./DetalheEvento", () => ({ DetalheEvento: () => null }));
vi.mock("./ObservacoesExcecao", () => ({ ObservacoesExcecao: () => null }));
vi.mock("./ImpedimentoMaterialOs", () => ({ ImpedimentoMaterialOs: () => null }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  sessionStorage.clear();
});

function montar() {
  // Rearmado a cada teste: o `restoreAllMocks` do afterEach apaga a implementação, e sem sessão
  // válida o componente só mostra "Não foi possível confirmar" — falha que não diz nada.
  auth.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
  api.informar.mockResolvedValue({});
  api.listarEventos.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DisponibilidadeMateriais
        usuario="u"
        cliente="c"
        ordemServico="os"
        listaId="lista"
        revisao={3}
      />
    </QueryClientProvider>,
  );
}
function registrar() {
  // A confirmação é recalculada a cada mudança de campo, então só pode ser marcada no fim.
  fireEvent.click(screen.getByLabelText(/Conferi a lista, revisão e informação/));
  fireEvent.click(screen.getByRole("button", { name: "Registrar informação" }));
}

it("oferece os 3 eventos novos no mesmo seletor dos antigos", () => {
  montar();
  const opcoes = Array.from(
    screen.getByLabelText(/Tipo de informação/).querySelectorAll("option"),
  ).map((o) => o.getAttribute("value"));
  expect(opcoes).toEqual(["disponibilidade", "excecao", "aquisicao", "dispensa", "conclusao"]);
});

it("envia aquisição sem observação quando o campo opcional fica vazio", async () => {
  montar();
  fireEvent.change(screen.getByLabelText(/Tipo de informação/), { target: { value: "aquisicao" } });
  registrar();
  await waitFor(() => expect(api.informar).toHaveBeenCalledTimes(1));
  // `observacao` em branco não pode ir no payload: o banco recusa string vazia.
  expect(api.informar.mock.calls[0][0].evento).toEqual({ tipo: "aquisicao", dados: {} });
  expect(api.informar.mock.calls[0][0].expectedRevision).toBe(3);
});

it("envia o motivo da dispensa no campo que o banco exige", async () => {
  montar();
  fireEvent.change(screen.getByLabelText(/Tipo de informação/), { target: { value: "dispensa" } });
  fireEvent.change(screen.getByLabelText(/Motivo da dispensa/), {
    target: { value: "Cliente retirou o item do escopo" },
  });
  registrar();
  await waitFor(() => expect(api.informar).toHaveBeenCalledTimes(1));
  expect(api.informar.mock.calls[0][0].evento).toEqual({
    tipo: "dispensa",
    dados: { motivo: "Cliente retirou o item do escopo" },
  });
});

it("avisa que concluir é definitivo antes de o usuário confirmar", async () => {
  montar();
  fireEvent.change(screen.getByLabelText(/Tipo de informação/), { target: { value: "conclusao" } });
  expect(screen.getByText(/nenhum evento é aceito/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Observação \(opcional\)/), {
    target: { value: "Material aplicado na OS" },
  });
  registrar();
  await waitFor(() => expect(api.informar).toHaveBeenCalledTimes(1));
  expect(api.informar.mock.calls[0][0].evento).toEqual({
    tipo: "conclusao",
    dados: { observacao: "Material aplicado na OS" },
  });
});
