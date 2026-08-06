import { describe, expect, it } from "vitest";
import { unirItensPlanejamento } from "./relatorio-planejamento";

describe("unirItensPlanejamento", () => {
  it("deduplica Agenda e OS pelo cliente/serviço e ordena pelo horário", () => {
    const itens = unirItensPlanejamento(
      [
        {
          id: "a",
          clienteId: "c",
          clienteNome: "Condomínio",
          tecnicoId: "t",
          tecnicoNome: "Ana",
          data: "2026-08-06",
          horaInicio: "08:00",
          descricao: "Vistoria da bomba",
        },
        {
          id: "b",
          clienteId: "c",
          clienteNome: "Condomínio",
          tecnicoId: "t",
          tecnicoNome: "Ana",
          data: "2026-08-06",
          horaInicio: "07:00",
          descricao: "Vistoria da bomba",
        },
      ],
      [
        {
          id: "o",
          clienteId: "c",
          clienteNome: "Condomínio",
          tecnicoId: "t",
          tecnicoNome: "Ana",
          data: "2026-08-06",
          localDescricao: null,
          titulo: "Vistoria da bomba",
          prioridade: "media",
          createdAt: "2026-08-01",
        },
      ],
    );
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ id: "os:o", origem: "os", horaInicio: "07:00" });
  });
});
