import { expect, it, vi } from "vitest";
import type { ApontamentoHorasItem } from "../domain/apontamento-horas";
import { obterApontamentoHoras } from "./apontamento-horas";
import type { ApontamentoHorasGateway } from "./apontamento-horas-gateway";

function item(
  osId: string,
  id: string | null,
  nome: string,
  horas = 2,
  clienteId = "cliente-a",
): ApontamentoHorasItem {
  return {
    osId,
    osNumero: osId,
    clienteId,
    clienteNome: "Fictício",
    tecnicoFuncionarioId: id,
    tecnicoNome: nome,
    horas,
    dataAgendada: null,
    checkInAt: null,
    checkOutAt: null,
  };
}

const recorte = { inicio: "2026-11-01", fim: "2026-11-27", clienteId: "cliente-a" };

function gateway() {
  return {
    listarApontamentos: vi.fn(async (inicio: string, fim: string) =>
      inicio === recorte.inicio && fim === recorte.fim
        ? [
            item("os-1", "ativo", "Nome antigo"),
            item("os-2", "inativo", "Técnico histórico"),
            item("os-3", "inativo", "Técnico histórico"),
            item("os-4", "sem-horas", "Sem horas", 0),
            item("os-5", null, "Sem vínculo"),
            item("os-6", "outro-cliente", "Outro cliente", 2, "cliente-b"),
          ]
        : [item("os-7", "fora-periodo", "Técnico fora do período")],
    ),
    listarClientes: vi.fn().mockResolvedValue([]),
    listarTecnicos: vi
      .fn()
      .mockResolvedValue([{ id: "ativo", nome: "Técnico ativo", jornadaDiariaHoras: 8 }]),
    obterParametros: vi
      .fn()
      .mockResolvedValue({ metaDiariaHoras: 8, toleranciaMinutos: 0, limiarAnomaliaMinutos: 30 }),
    salvarParametros: vi.fn(),
    buscarValorHora: vi.fn(),
  } satisfies ApontamentoHorasGateway;
}

it("inclui ativos e técnicos com horas autorizadas no recorte, uma vez por ID", async () => {
  const api = gateway();
  const resultado = await obterApontamentoHoras(api, {
    ...recorte,
    tecnicoFuncionarioId: "inativo",
  });
  expect(api.listarApontamentos).toHaveBeenCalledExactlyOnceWith(recorte.inicio, recorte.fim);
  expect(api.listarTecnicos).toHaveBeenCalledTimes(1);
  expect(resultado.tecnicos).toEqual([
    { id: "ativo", nome: "Técnico ativo", jornadaDiariaHoras: 8 },
    { id: "inativo", nome: "Técnico histórico", jornadaDiariaHoras: null },
  ]);
  expect(resultado.itens.map(({ osId }) => osId)).toEqual(["os-2", "os-3"]);
  const outro = await obterApontamentoHoras(api, {
    ...recorte,
    inicio: "2026-10-01",
    fim: "2026-10-31",
  });
  expect(outro.tecnicos.map(({ id }) => id)).toEqual(["ativo", "fora-periodo"]);
});

it("não entrega opções históricas se a leitura autorizada falhar", async () => {
  const api = gateway();
  const negacao = new Error("Sem permissão");
  api.listarApontamentos.mockRejectedValueOnce(negacao);
  await expect(obterApontamentoHoras(api, recorte)).rejects.toBe(negacao);
  expect(api.salvarParametros).not.toHaveBeenCalled();
});
