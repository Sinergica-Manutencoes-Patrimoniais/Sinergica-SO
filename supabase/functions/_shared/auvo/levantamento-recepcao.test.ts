import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { prepararLevantamentoEstruturado } from "./levantamento-recepcao.ts";

const contrato = { questionarioId: "levantamento", versao: "1", campos: { nome: "nome", qtd: "quantidade" } };
const entrada = {
  envelopeId: "16582000-0000-0000-0000-000000000001",
  clienteId: "16582000-0000-0000-0000-00000000000a",
  osId: "16582000-0000-0000-0000-000000000011",
  taskId: "123",
  questionarioId: "levantamento",
  versao: "1",
  linhas: [{ chave: "linha-1", tipo: "componente", respostas: { nome: " Bomba ", qtd: 2 }, fotos: [] }],
};

Deno.test("recepção mantém UUIDs legados e mapeamentos parciais", () => {
  const resultado = prepararLevantamentoEstruturado(entrada, contrato);
  assertEquals(resultado.estado, "preparado");
  if (resultado.estado === "preparado") {
    assertEquals(resultado.origem.clienteId, entrada.clienteId);
    assertEquals(resultado.linhas[0].atributos, { nome: "Bomba", quantidade: 2 });
  }
});

Deno.test("recepção rejeita identificador malformado", () => {
  assertEquals(prepararLevantamentoEstruturado({ ...entrada, clienteId: "inválido" }, contrato), {
    estado: "pendente", motivo: "entrada_invalida",
  });
});

Deno.test("recepção rejeita mais de mil linhas", () => {
  assertEquals(prepararLevantamentoEstruturado({ ...entrada, linhas: Array.from({ length: 1001 }, () => entrada.linhas[0]) }, contrato), {
    estado: "pendente", motivo: "entrada_invalida",
  });
});
