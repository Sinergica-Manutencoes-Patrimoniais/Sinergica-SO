import { beforeEach, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({ resposta: [] as unknown[], ordenacao: "", cursor: "" }));
vi.mock("../../../lib/supabase-client", () => {
  const consulta = {
    select: () => consulta,
    eq: () => consulta,
    order: (coluna: string) => {
      banco.ordenacao = coluna;
      return consulta;
    },
    limit: () => consulta,
    gt: (_coluna: string, valor: string) => {
      banco.cursor = valor;
      return consulta;
    },
    // biome-ignore lint/suspicious/noThenProperty: o builder Supabase é awaitable.
    then: (resolver: (valor: unknown) => void) => resolver({ data: banco.resposta, error: null }),
  };
  return { supabase: { schema: () => ({ from: () => consulta }) } };
});

import { listarCategoriasDespesa, listarDespesasVisita } from "./supabase-despesas-visita-adapter";

const cliente = "18000000-0000-4000-8000-000000000001";
const visita = "18000000-0000-4000-8000-000000000002";
const linha = (id: string) => ({
  id,
  cliente_id: cliente,
  visita_id: visita,
  descricao: "Despesa",
  data: "2026-10-30",
  previsto_centavos: 100,
  realizado_centavos: null,
  status: "ativa",
  revisao: 1,
});
beforeEach(() => {
  banco.resposta = [];
  banco.ordenacao = "";
  banco.cursor = "";
});

it("consulta a próxima página de categorias por identificador estável", async () => {
  const cursor = "18000000-0000-4000-8000-000000000010";
  banco.resposta = [{ id: "18000000-0000-4000-8000-000000000011", nome: "Transporte" }];
  expect(await listarCategoriasDespesa(cursor)).toEqual([
    { id: "18000000-0000-4000-8000-000000000011", nome: "Transporte" },
  ]);
  expect(banco.ordenacao).toBe("id");
  expect(banco.cursor).toBe(cursor);
});

it("recusa categoria anterior ou repetida no cursor", async () => {
  const cursor = "18000000-0000-4000-8000-000000000010";
  banco.resposta = [{ id: cursor, nome: "Transporte" }];
  await expect(listarCategoriasDespesa(cursor)).rejects.toThrow();
});

it("recusa páginas repetidas ou fora da ordem do cursor", async () => {
  const anterior = "18000000-0000-4000-8000-000000000010";
  banco.resposta = [linha("18000000-0000-4000-8000-000000000011"), linha(anterior)];
  await expect(listarDespesasVisita(cliente, visita, anterior)).rejects.toThrow();
});

it("aceita uma página ordenada da Visita e preserva ausência de realizado", async () => {
  banco.resposta = [linha("18000000-0000-4000-8000-000000000011")];
  const resultado = await listarDespesasVisita(
    cliente,
    visita,
    "18000000-0000-4000-8000-000000000010",
  );
  expect(resultado).toHaveLength(1);
  expect(resultado[0]?.realizadoCentavos).toBeNull();
});

it("recusa página maior que o limite negociado", async () => {
  banco.resposta = Array.from({ length: 21 }, (_, indice) =>
    linha(`18000000-0000-4000-8000-${String(indice + 1).padStart(12, "0")}`),
  );
  await expect(listarDespesasVisita(cliente, visita, null)).rejects.toThrow();
});
