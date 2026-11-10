import { describe, expect, it, vi } from "vitest";
import { criarOperacoesVisita } from "./visitas";

const usuario = "17100000-0000-4000-8000-000000000001";
const cliente = "17100000-0000-4000-8000-00000000000a";
const visita = "17100000-0000-4000-8000-000000000064";
const requestId = "17100000-0000-4000-8000-000000000101";
const resultado = { aggregateId: visita, revision: 8, state: "confirmada", created: false,
  linkedIds: { clienteId: cliente }, warnings: [], requestId };

function memoria() {
  const dados = new Map<string, string>();
  return { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => { dados.set(k, v); }, removeItem: (k: string) => { dados.delete(k); } };
}

describe("operações recuperáveis de Visita", () => {
  it("recupera resultado incerto com a mesma chave e conteúdo após reinício", async () => {
    const storage = memoria();
    const confirmar = vi.fn().mockRejectedValueOnce(new Error("conexão interrompida")).mockResolvedValueOnce(resultado);
    const primeira = criarOperacoesVisita({ confirmar }, storage, { usuarioId: usuario, clienteId: cliente, visitaId: visita });
    const pedido = { tipo: "confirmar" as const, comando: { requestId, expectedRevision: 7, visitaId: visita } };
    await expect(primeira.iniciar(pedido)).rejects.toThrow("conexão interrompida");
    const retomada = criarOperacoesVisita({ confirmar }, storage, { usuarioId: usuario, clienteId: cliente, visitaId: visita });
    expect(retomada.pendente()).toEqual(pedido);
    await expect(retomada.repetir()).resolves.toEqual(resultado);
    expect(confirmar).toHaveBeenNthCalledWith(2, pedido.comando);
    expect(retomada.pendente()).toBeNull();
  });

  it("não substitui operação incerta com outro conteúdo", async () => {
    const storage = memoria();
    const confirmar = vi.fn().mockRejectedValue(new Error("rede"));
    const operacoes = criarOperacoesVisita({ confirmar }, storage, { usuarioId: usuario, clienteId: cliente, visitaId: visita });
    await expect(operacoes.iniciar({ tipo: "confirmar", comando: { requestId, expectedRevision: 7, visitaId: visita } })).rejects.toThrow();
    await expect(operacoes.iniciar({ tipo: "confirmar", comando: { requestId, expectedRevision: 8, visitaId: visita } })).rejects.toThrow(/pendente/i);
    expect(confirmar).toHaveBeenCalledTimes(1);
  });

  it("não envia quando armazenamento falha ou comando pertence a outra Visita", async () => {
    const confirmar = vi.fn();
    const storage = { getItem: () => null, setItem: () => { throw new Error("armazenamento"); }, removeItem: () => {} };
    const operacoes = criarOperacoesVisita({ confirmar }, storage, { usuarioId: usuario, clienteId: cliente, visitaId: visita });
    await expect(operacoes.iniciar({ tipo: "confirmar", comando: { requestId, expectedRevision: 7, visitaId: visita } })).rejects.toThrow("armazenamento");
    await expect(operacoes.iniciar({ tipo: "confirmar", comando: { requestId, expectedRevision: 7, visitaId: cliente } })).rejects.toThrow();
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("recusa recuperação corrompida e isola a sessão por usuário e Cliente", async () => {
    const storage = memoria();
    const confirmar = vi.fn().mockRejectedValue(new Error("rede"));
    const contexto = { usuarioId: usuario, clienteId: cliente, visitaId: visita };
    const operacoes = criarOperacoesVisita({ confirmar }, storage, contexto);
    await expect(operacoes.iniciar({ tipo: "confirmar", comando: { requestId, expectedRevision: 7, visitaId: visita } })).rejects.toThrow();
    expect(criarOperacoesVisita({ confirmar }, storage, { ...contexto, usuarioId: cliente }).pendente()).toBeNull();
    expect(criarOperacoesVisita({ confirmar }, storage, { ...contexto, clienteId: usuario }).pendente()).toBeNull();
    storage.setItem(`sso-visita-operacao:${usuario}:${cliente}:${visita}`, "inválido");
    expect(() => operacoes.pendente()).toThrow();
  });

  it("recupera ciência e planejamento sem trocar dados ou destino", async () => {
    const storage = memoria();
    const registrarCiencia = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce(resultado);
    const planejar = vi.fn().mockResolvedValue(resultado);
    const operacoes = criarOperacoesVisita({ registrarCiencia, planejar }, storage, { usuarioId: usuario, clienteId: cliente, visitaId: visita });
    const comando = { requestId, expectedRevision: 7, visitaId: visita, cienciaEm: "2026-10-20T12:00:00Z", responsavel: "Síndica", canal: "Telefone", observacao: "Ciente" };
    await expect(operacoes.iniciar({ tipo: "registrarCiencia", comando })).rejects.toThrow("rede");
    await operacoes.repetir();
    expect(registrarCiencia).toHaveBeenNthCalledWith(2, comando);
    await operacoes.iniciar({ tipo: "planejar", comando: { requestId, expectedRevision: 7, visitaId: visita } });
    expect(planejar).toHaveBeenCalledWith({ requestId, expectedRevision: 7, visitaId: visita });
  });

  it("rejeita resposta definitiva de revisão obsoleta e permite corrigir após nova consulta", async () => {
    const storage = memoria();
    const confirmar = vi.fn().mockRejectedValue({ code: "40001" });
    const operacoes = criarOperacoesVisita({ confirmar }, storage, { usuarioId: usuario, clienteId: cliente, visitaId: visita });
    await expect(operacoes.iniciar({ tipo: "confirmar", comando: { requestId, expectedRevision: 7, visitaId: visita } })).rejects.toMatchObject({ code: "40001" });
    expect(operacoes.pendente()).toBeNull();
  });

  it.each(["22023", "23514"])("libera nova tentativa após recusa definitiva %s", async (code) => {
    const operacoes = criarOperacoesVisita({ confirmar: vi.fn().mockRejectedValue({ code }) }, memoria(), { usuarioId: usuario, clienteId: cliente, visitaId: visita });
    await expect(operacoes.iniciar({ tipo: "confirmar", comando: { requestId, expectedRevision: 7, visitaId: visita } })).rejects.toMatchObject({ code });
    expect(operacoes.pendente()).toBeNull();
  });

  it("preserva pedido incerto se permissão for revogada durante o retry", async () => {
    const confirmar = vi.fn().mockRejectedValueOnce(new Error("rede")).mockRejectedValueOnce({ code: "42501" });
    const operacoes = criarOperacoesVisita({ confirmar }, memoria(), { usuarioId: usuario, clienteId: cliente, visitaId: visita });
    const pedido = { tipo: "confirmar" as const, comando: { requestId, expectedRevision: 7, visitaId: visita } };
    await expect(operacoes.iniciar(pedido)).rejects.toThrow("rede");
    await expect(operacoes.repetir()).rejects.toMatchObject({ code: "42501" });
    expect(operacoes.pendente()).toEqual(pedido);
  });

  it("libera correção para conflito comprovado de sequência, mas preserva conflito de requestId", async () => {
    const storage = memoria();
    const associarOs = vi.fn().mockRejectedValueOnce({ code: "23505", message: 'duplicate key value violates unique constraint "uq_visita_sequencia_vigente"' })
      .mockRejectedValueOnce({ code: "23505", message: "request_id_conflitante" });
    const operacoes = criarOperacoesVisita({ associarOs }, storage, { usuarioId: usuario, clienteId: cliente, visitaId: visita });
    const pedido = { tipo: "associarOs" as const, comando: { requestId, expectedRevision: 7, visitaId: visita,
      osId: cliente, vinculoId: usuario, sequencia: 1, estimativaMinutos: null } };
    await expect(operacoes.iniciar(pedido)).rejects.toMatchObject({ code: "23505" });
    expect(operacoes.pendente()).toBeNull();
    await expect(operacoes.iniciar(pedido)).rejects.toMatchObject({ code: "23505" });
    expect(operacoes.pendente()).toEqual(pedido);
  });

  it("retry antigo não apaga outra operação iniciada enquanto resposta atrasada chega", async () => {
    const storage = memoria();
    let terminarAntigo!: (valor: typeof resultado) => void;
    const confirmar = vi.fn().mockResolvedValueOnce(resultado).mockImplementationOnce(() => new Promise((resolve) => { terminarAntigo = resolve; }));
    const planejar = vi.fn().mockRejectedValue(new Error("rede"));
    const operacoes = criarOperacoesVisita({ confirmar, planejar }, storage, { usuarioId: usuario, clienteId: cliente, visitaId: visita });
    const primeira = operacoes.iniciar({ tipo: "confirmar", comando: { requestId, expectedRevision: 7, visitaId: visita } });
    const retryAntigo = operacoes.repetir();
    await primeira;
    const proxima = { tipo: "planejar" as const, comando: { requestId, expectedRevision: 8, visitaId: visita } };
    await expect(operacoes.iniciar(proxima)).rejects.toThrow("rede");
    terminarAntigo(resultado);
    await retryAntigo;
    expect(operacoes.pendente()).toEqual(proxima);
  });

  it("recupera criação, edição, OS e equipe com comandos originais", async () => {
    const storage = memoria();
    const resposta = () => vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce(resultado);
    const gateway = { criar: resposta(), editar: resposta(), associarOs: resposta(), adicionarMembro: resposta(), encerrarMembro: resposta() };
    const operacoes = criarOperacoesVisita(gateway, storage, { usuarioId: usuario, clienteId: cliente, visitaId: visita });
    const comum = { requestId, expectedRevision: 7, visitaId: visita };
    const dados = { ...comum, areaId: null, localId: null, inicioEm: "2026-11-01T11:00:00Z", fimEm: "2026-11-01T13:00:00Z", fuso: "America/Sao_Paulo", responsavelId: null, deslocamentoMinutos: 30 };
    const pedidos = [
      { tipo: "criar" as const, comando: { ...dados, expectedRevision: 0 as const, clienteId: cliente, contratoId: null, natureza: "extra" as const } },
      { tipo: "editar" as const, comando: dados },
      { tipo: "associarOs" as const, comando: { ...comum, osId: visita, vinculoId: requestId, sequencia: 1, estimativaMinutos: null } },
      { tipo: "adicionarMembro" as const, comando: { ...comum, funcionarioId: visita, participacaoId: requestId, papel: "Técnico", estimativaMinutos: null } },
      { tipo: "encerrarMembro" as const, comando: { ...comum, participacaoId: requestId, motivo: "Mudança" } },
    ];
    for (const pedido of pedidos) {
      await expect(operacoes.iniciar(pedido)).rejects.toThrow("rede");
      expect(operacoes.pendente()).toEqual(pedido);
      await operacoes.repetir();
      expect(gateway[pedido.tipo]).toHaveBeenNthCalledWith(2, pedido.comando);
    }
  });

  it("não cria Visita em Cliente diferente do contexto e rejeita janela inválida", async () => {
    const criar = vi.fn();
    const operacoes = criarOperacoesVisita({ criar }, memoria(), { usuarioId: usuario, clienteId: cliente, visitaId: visita });
    const comando = { requestId, expectedRevision: 0 as const, visitaId: visita, clienteId: usuario, contratoId: null,
      areaId: null, localId: null, inicioEm: "2026-11-01T11:00:00Z", fimEm: "2026-11-01T13:00:00Z",
      fuso: "America/Sao_Paulo", natureza: "extra" as const, responsavelId: null, deslocamentoMinutos: 30 };
    await expect(operacoes.iniciar({ tipo: "criar", comando })).rejects.toThrow();
    await expect(operacoes.iniciar({ tipo: "criar", comando: { ...comando, clienteId: cliente, fimEm: "2026-11-01T10:00:00Z" } })).rejects.toThrow();
    expect(criar).not.toHaveBeenCalled();
  });
});
