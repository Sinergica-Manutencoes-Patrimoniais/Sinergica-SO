import { describe, expect, it, vi } from "vitest";
import type { Cliente360Gateway, ClienteHeader, OrdemServicoResumo } from "./cliente-360-gateway";
import { obterVisaoCliente } from "./obter-visao-cliente";

// specs/E01-S12-visao-360-cliente — AC-2, AC-3, AC-4, AC-5, AC-6, AC-8

const CLIENTE: ClienteHeader = {
  id: "c1",
  nome: "Cond. Primavera",
  cnpj: "12.345.678/0001-99",
  auvoId: 4242,
  ativo: true,
};

function os(over: Partial<OrdemServicoResumo> = {}): OrdemServicoResumo {
  return {
    id: "os1",
    numero: "CH-001",
    titulo: "Vazamento",
    categoria: "corretiva",
    status: "solicitacao",
    scorePcm: 60,
    gravidade: 4,
    urgencia: 3,
    tendencia: 5,
    auvoSyncStatus: null,
    ...over,
  };
}

function gatewayMock(overrides: Partial<Cliente360Gateway> = {}): Cliente360Gateway {
  return {
    listarClientes: vi.fn(async () => []),
    buscarCliente: vi.fn(async () => CLIENTE),
    listarBacklogCliente: vi.fn(async () => [os()]),
    listarHistoricoCliente: vi.fn(async () => [os({ id: "os2", status: "finalizado" })]),
    listarEquipamentosCliente: vi.fn(async () => [{ id: "e1", nome: "Elevador" }]),
    ...overrides,
  };
}

describe("obterVisaoCliente", () => {
  // AC-8: cliente não encontrado / soft-deleted → estado explícito, sem erro
  it("AC-8: retorna nao_encontrado quando o cliente não existe", async () => {
    const backlog = vi.fn(async () => []);
    const gateway = gatewayMock({
      buscarCliente: vi.fn(async () => null),
      listarBacklogCliente: backlog,
    });

    const resultado = await obterVisaoCliente(gateway, "inexistente");

    expect(resultado).toEqual({ tipo: "nao_encontrado" });
    // não dispara as demais queries se o cliente não existe
    expect(backlog).not.toHaveBeenCalled();
  });

  // AC-2/AC-3/AC-4: caminho feliz completo
  it("AC-2/3/4: repassa cabeçalho, backlog e histórico do gateway", async () => {
    const gateway = gatewayMock();
    const resultado = await obterVisaoCliente(gateway, "c1");

    expect(resultado.tipo).toBe("ok");
    if (resultado.tipo !== "ok") throw new Error("esperava ok");
    expect(resultado.cliente).toEqual(CLIENTE);
    expect(resultado.backlog).toHaveLength(1);
    expect(resultado.historico[0]?.status).toBe("finalizado");
  });

  // AC-5: cliente sem nenhuma OS → backlog e histórico vazios, sem erro
  it("AC-5: cliente sem OS retorna backlog e histórico vazios", async () => {
    const gateway = gatewayMock({
      listarBacklogCliente: vi.fn(async () => []),
      listarHistoricoCliente: vi.fn(async () => []),
    });

    const resultado = await obterVisaoCliente(gateway, "c1");

    expect(resultado.tipo).toBe("ok");
    if (resultado.tipo !== "ok") throw new Error("esperava ok");
    expect(resultado.backlog).toEqual([]);
    expect(resultado.historico).toEqual([]);
  });

  // AC-6: equipamentos "indisponivel" não derruba o resto da visão
  it("AC-6: equipamentos 'indisponivel' é repassado sem afetar cabeçalho/backlog/histórico", async () => {
    const gateway = gatewayMock({
      listarEquipamentosCliente: vi.fn(async () => "indisponivel" as const),
    });

    const resultado = await obterVisaoCliente(gateway, "c1");

    expect(resultado.tipo).toBe("ok");
    if (resultado.tipo !== "ok") throw new Error("esperava ok");
    expect(resultado.equipamentos).toBe("indisponivel");
    expect(resultado.backlog).toHaveLength(1);
    expect(resultado.historico).toHaveLength(1);
  });

  // AC-6 (achado @qa C1): erro INESPERADO no gateway de equipamentos (não só PGRST205/42P01, mas
  // qualquer throw — ex.: E01-S11 mergear com coluna diferente e o PostgREST devolver 42703) NÃO
  // pode derrubar cabeçalho/backlog/histórico. O painel degrada para "indisponivel", o resto renderiza.
  it("AC-6: erro inesperado nos equipamentos degrada só o painel, sem derrubar o resto", async () => {
    const gateway = gatewayMock({
      listarEquipamentosCliente: vi.fn(async () => {
        throw new Error("PGRST204: column pcm.equipamentos_cache.cliente_auvo_id does not exist");
      }),
    });

    const resultado = await obterVisaoCliente(gateway, "c1");

    expect(resultado.tipo).toBe("ok");
    if (resultado.tipo !== "ok") throw new Error("esperava ok");
    expect(resultado.equipamentos).toBe("indisponivel");
    // o núcleo continua vivo — é o ponto do achado C1
    expect(resultado.cliente).toEqual(CLIENTE);
    expect(resultado.backlog).toHaveLength(1);
    expect(resultado.historico).toHaveLength(1);
  });

  // Contraste: falha em backlog/histórico (conteúdo central) NÃO é isolada — propaga (a página
  // deve entrar em erro, não fingir que está tudo bem).
  it("erro no backlog (conteúdo central) propaga — não é engolido", async () => {
    const gateway = gatewayMock({
      listarBacklogCliente: vi.fn(async () => {
        throw new Error("falha real de leitura do backlog");
      }),
    });

    await expect(obterVisaoCliente(gateway, "c1")).rejects.toThrow(/backlog/);
  });

  // AC-6: lista real de equipamentos é repassada como está
  it("AC-6: lista de equipamentos é repassada intacta", async () => {
    const gateway = gatewayMock();
    const resultado = await obterVisaoCliente(gateway, "c1");

    expect(resultado.tipo).toBe("ok");
    if (resultado.tipo !== "ok") throw new Error("esperava ok");
    expect(resultado.equipamentos).toEqual([{ id: "e1", nome: "Elevador" }]);
  });

  it("passa o auvoId do cliente para a query de equipamentos", async () => {
    const equip = vi.fn(async () => "indisponivel" as const);
    const gateway = gatewayMock({ listarEquipamentosCliente: equip });

    await obterVisaoCliente(gateway, "c1");

    expect(equip).toHaveBeenCalledWith("c1", 4242);
  });
});
