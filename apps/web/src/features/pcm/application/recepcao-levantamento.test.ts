import { expect, it } from "vitest";
import { criarRegistroRecepcao } from "./recepcao-levantamento";

it("reutiliza requestId e impede trocar dados até resultado conhecido", () => {
  const valores = new Map<string, string>();
  const storage = {
    getItem: (k: string) => valores.get(k) ?? null,
    setItem: (k: string, v: string) => {
      valores.set(k, v);
    },
    removeItem: (k: string) => {
      valores.delete(k);
    },
  };
  const registro = criarRegistroRecepcao(
    "usuario",
    "cliente",
    storage,
    () => "17810000-0000-4000-8000-000000000001",
  );
  const dados = {
    origem: "campo" as const,
    chaveOrigem: "levantamento-1",
    linhas: [{ chave: "1", tipo: "sistema" as const, atributos: { nome: "Bomba" } }],
  };
  const pedido = registro.preparar(dados);
  expect(registro.preparar(dados)).toEqual(pedido);
  expect(() => registro.preparar({ ...dados, chaveOrigem: "outro" })).toThrow();
  expect(criarRegistroRecepcao("usuario", "outro-cliente", storage).pendente()).toBeNull();
  registro.concluir(pedido.requestId);
  expect(registro.pendente()).toBeNull();
});

it("bloqueia armazenamento corrompido sem descartá-lo", () => {
  const storage = {
    getItem: () => "invalido",
    setItem: () => {
      throw new Error("não deve gravar");
    },
    removeItem: () => {
      throw new Error("não deve apagar");
    },
  };
  expect(() => criarRegistroRecepcao("usuario", "cliente", storage).pendente()).toThrow();
});
