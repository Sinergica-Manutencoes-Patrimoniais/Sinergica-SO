import { expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { levantamentoQueryKeys } from "./levantamento-queries";

it("não compartilha cache de itens do levantamento entre Clientes", () => {
  const cache = new QueryClient();
  cache.setQueryData(levantamentoQueryKeys.itens("inspecao", "cliente-a"), [
    { descricao: "Item de A" },
  ]);
  expect(cache.getQueryData(levantamentoQueryKeys.itens("inspecao", "cliente-b"))).toBeUndefined();
  expect(cache.getQueryData(levantamentoQueryKeys.itens("inspecao", "cliente-a"))).toEqual([
    { descricao: "Item de A" },
  ]);
});
