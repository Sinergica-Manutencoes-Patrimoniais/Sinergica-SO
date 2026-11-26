// @vitest-environment jsdom
// DEF-17: abrir uma oportunidade na aba Comercial da Visão 360 deixava a área da aplicação
// vazia, sem menu nem mensagem, e só recarregar recuperava. O painel chamava
// `useCargaVisivel` DEPOIS de três returns condicionais — entre eles o que troca a lista pelo
// editor de propostas. Abrir a oportunidade reduzia a contagem de hooks entre renders, o React
// derrubava a árvore e, sem error boundary, a tela ficava em branco.
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  etapas: vi.fn(),
  oportunidades: vi.fn(),
  levantamentos: vi.fn(),
}));

vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar: () => true }),
}));
vi.mock("../application/comercial-queries", () => ({
  useEtapas: () => mocks.etapas(),
  useOportunidadesDaConta: () => mocks.oportunidades(),
}));
vi.mock("../application/levantamento-queries", () => ({
  useLevantamentosDaConta: () => mocks.levantamentos(),
  useCriarLevantamento: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../infrastructure/supabase-comercial-adapter", () => ({ supabaseComercialAdapter: {} }));
vi.mock("../infrastructure/supabase-levantamento-adapter", () => ({
  supabaseLevantamentoAdapter: {},
}));
vi.mock("../pages/PropostaEditorPage", () => ({
  PropostaEditorPage: () => <div>Editor de propostas</div>,
}));
vi.mock("./NovaOportunidadeModal", () => ({ NovaOportunidadeModal: () => null }));

import { PainelComercialCliente } from "./PainelComercialCliente";

const CLIENTE = "17040000-0000-4000-8000-00000000000a";
const oportunidade = {
  id: "17040000-0000-4000-8000-000000000001",
  clienteId: CLIENTE,
  etapaId: "17040000-0000-4000-8000-0000000000e1",
  titulo: "[TESTE] Oportunidade do Escritório",
  descricao: null,
  valorEstimadoCentavos: 10000,
  score: null,
  resumo: null,
  origem: null,
  leadTier: null,
  clusterNome: null,
  conversaId: null,
  responsavelId: null,
  motivoPerdaId: null,
  fechadaEm: null,
  criadaEm: "2026-11-25",
};

let erros: string[] = [];
let spy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  erros = [];
  spy = vi.spyOn(console, "error").mockImplementation((...args) => {
    erros.push(args.map(String).join(" "));
  });
  mocks.etapas.mockReturnValue({
    data: [{ id: oportunidade.etapaId, nome: "Qualificação", ordem: 1, cor: "#888888" }],
    error: null,
    isPending: false,
  });
  mocks.oportunidades.mockReturnValue({
    data: [oportunidade],
    error: null,
    isPending: false,
  });
  mocks.levantamentos.mockReturnValue({ data: [], error: null, isPending: false });
});

afterEach(() => {
  spy.mockRestore();
});

/** Reproduz a sequência real: a lista monta, e um segundo render abre a oportunidade. */
function PainelComAberturaDeOportunidade() {
  const [montado, setMontado] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setMontado(true)}>
        forçar re-render
      </button>
      <PainelComercialCliente clienteId={CLIENTE} clienteNome="Escritório" />
      {montado && null}
    </>
  );
}

it("não quebra a contagem de hooks ao trocar a lista pelo editor de propostas", async () => {
  const { rerender } = render(<PainelComAberturaDeOportunidade />);
  expect(screen.getByText("Oportunidades")).toBeTruthy();

  // Agora a consulta responde "carregando": é a troca de estado que, com o hook depois dos
  // returns condicionais, mudava a contagem de hooks entre um render e outro.
  mocks.oportunidades.mockReturnValue({ data: undefined, error: null, isPending: true });
  rerender(<PainelComAberturaDeOportunidade />);

  // E então uma falha, que dispara outro return condicional antes do hook.
  mocks.oportunidades.mockReturnValue({
    data: undefined,
    error: new Error("Falha ao carregar o funil."),
    isPending: false,
  });
  rerender(<PainelComAberturaDeOportunidade />);
  expect(screen.getByText("Falha ao carregar o funil.")).toBeTruthy();

  const avisoDeHooks = erros.filter((e) => /hook/i.test(e));
  expect(avisoDeHooks).toEqual([]);
});
