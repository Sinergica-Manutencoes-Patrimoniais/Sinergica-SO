import { expect, it } from "vitest";
import { osAguardandoAvaliacao } from "./avaliacao-os";

const os = (id: string, status: string) => ({ id, status });

it("só OS finalizada e ainda não avaliada aguarda avaliação", () => {
  const lista = [
    os("aberta", "solicitacao"),
    os("finalizada", "finalizado"),
    os("cancelada", "cancelado"),
    os("ja-avaliada", "finalizado"),
  ];
  expect(osAguardandoAvaliacao(lista, new Set(["ja-avaliada"])).map((o) => o.id)).toEqual([
    "finalizada",
  ]);
});
