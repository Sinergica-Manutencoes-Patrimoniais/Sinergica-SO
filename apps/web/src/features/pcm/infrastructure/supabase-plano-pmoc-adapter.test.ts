import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: api.getUser } },
}));

import {
  criarPlanoDoContratoPmoc,
  listarContratosPmocSemPlano,
  resumirCoberturaPlanoPmoc,
} from "./supabase-plano-pmoc-adapter";

const ATOR = "44444444-4444-4444-8444-444444444444";
const CLIENTE = "11111111-1111-4111-8111-111111111111";
const CONTRATO = "22222222-2222-4222-8222-222222222222";
const PLANO = "33333333-3333-4333-8333-333333333333";
const VINCULO = "55555555-5555-4555-8555-555555555555";
const PEDIDO = "66666666-6666-4666-8666-666666666666";

afterEach(() => vi.clearAllMocks());

function comSessao() {
  api.getUser.mockResolvedValue({ data: { user: { id: ATOR } }, error: null });
}

const CONTRATO_LINHA = {
  contrato_id: CONTRATO,
  imovel_id: "77777777-7777-4777-8777-777777777777",
  imovel_nome: "Edifício Guainumbi",
  imovel_cidade: "Campinas",
  art_numero: "ART-2026-1",
  vigencia_inicio: "2026-01-01",
  vigencia_fim: "2026-12-31",
  status: "ativo",
  equipamentos_ativos: 2,
  agendamentos: 12,
  periodicidades: ["mensal", "trimestral"],
};

const RECIBO = {
  requestId: PEDIDO,
  planoId: PLANO,
  vinculoId: VINCULO,
  contratoPmocId: CONTRATO,
  clienteId: CLIENTE,
  nome: "PMOC — Edifício Guainumbi",
  modalidade: "pmoc",
  estado: "rascunho",
  revisao: 1,
  criadoPorHumano: true,
  rotinasCriadas: 0,
  contratoPmocPreservado: true,
  derivado: { imovelNome: "Edifício Guainumbi" },
};

it("lista os Contratos PMOC pendentes do Cliente, com o que é derivável", async () => {
  comSessao();
  api.rpc.mockReturnValue({
    abortSignal: () => Promise.resolve({ data: [CONTRATO_LINHA], error: null }),
  });
  const pendentes = await listarContratosPmocSemPlano(CLIENTE, new AbortController().signal);
  expect(pendentes).toHaveLength(1);
  expect(pendentes[0]?.periodicidades).toEqual(["mensal", "trimestral"]);
  expect(pendentes[0]?.equipamentosAtivos).toBe(2);
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_contratos_pmoc_sem_plano", {
    p_ator_id: ATOR,
    p_cliente_id: CLIENTE,
    p_limite: 200,
  });
});

it("contrato sem cronograma vira lista de periodicidades vazia, não some da pendência", async () => {
  comSessao();
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        data: [{ ...CONTRATO_LINHA, periodicidades: null, agendamentos: 0 }],
        error: null,
      }),
  });
  const [contrato] = await listarContratosPmocSemPlano(CLIENTE, new AbortController().signal);
  expect(contrato?.periodicidades).toEqual([]);
  expect(contrato?.agendamentos).toBe(0);
});

it("o erro nomeado do gate sobe CRU — nunca vira lista vazia aqui", async () => {
  comSessao();
  api.rpc.mockReturnValue({
    abortSignal: () => Promise.resolve({ data: null, error: { message: "operacao_desabilitada" } }),
  });
  await expect(
    listarContratosPmocSemPlano(CLIENTE, new AbortController().signal),
  ).rejects.toMatchObject({ message: "operacao_desabilitada" });
});

it("o resumo de cobertura traz o progresso e o contrato órfão", async () => {
  comSessao();
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        data: [
          {
            cliente_id: CLIENTE,
            contratos_total: 4,
            contratos_com_plano: 1,
            contratos_sem_plano: 3,
            planos_modalidade_pmoc: 1,
            contratos_sem_cliente: 2,
          },
        ],
        error: null,
      }),
  });
  const cobertura = await resumirCoberturaPlanoPmoc(CLIENTE, new AbortController().signal);
  expect(cobertura.contratosSemPlano).toBe(3);
  expect(cobertura.contratosSemCliente).toBe(2);
});

it("a criação manda sempre a confirmação humana e devolve o recibo do mesmo pedido", async () => {
  comSessao();
  api.rpc.mockResolvedValue({ data: RECIBO, error: null });
  const recibo = await criarPlanoDoContratoPmoc({
    requestId: PEDIDO,
    clienteId: CLIENTE,
    contratoPmocId: CONTRATO,
    nome: null,
  });
  expect(recibo.planoId).toBe(PLANO);
  expect(api.rpc).toHaveBeenCalledWith("sso_criar_plano_do_contrato_pmoc", {
    p_ator_id: ATOR,
    p_request_id: PEDIDO,
    p_cliente_id: CLIENTE,
    p_contrato_pmoc_id: CONTRATO,
    p_nome: null,
    p_confirma_criacao: true,
  });
});

it("recibo de OUTRO contrato é falha, nunca sucesso silencioso", async () => {
  comSessao();
  api.rpc.mockResolvedValue({
    data: { ...RECIBO, contratoPmocId: "88888888-8888-4888-8888-888888888888" },
    error: null,
  });
  await expect(
    criarPlanoDoContratoPmoc({
      requestId: PEDIDO,
      clienteId: CLIENTE,
      contratoPmocId: CONTRATO,
      nome: null,
    }),
  ).rejects.toThrow("divergente");
});

it("recibo que diz ter criado Rotina é recusado — isso seria a alternativa (a)", async () => {
  comSessao();
  api.rpc.mockResolvedValue({ data: { ...RECIBO, rotinasCriadas: 12 }, error: null });
  await expect(
    criarPlanoDoContratoPmoc({
      requestId: PEDIDO,
      clienteId: CLIENTE,
      contratoPmocId: CONTRATO,
      nome: null,
    }),
  ).rejects.toThrow("inesperado");
});

it("sem sessão nada chega ao banco", async () => {
  api.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(listarContratosPmocSemPlano(CLIENTE)).rejects.toThrow("Sessão indisponível.");
  expect(api.rpc).not.toHaveBeenCalled();
});
