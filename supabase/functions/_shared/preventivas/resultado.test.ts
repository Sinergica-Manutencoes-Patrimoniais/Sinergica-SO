import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { consolidarResultadoPreventiva } from "./resultado.ts";

Deno.test("consolidarResultadoPreventiva — qualquer resposta explicitamente Não OK reprova ocorrência", () => {
  assertEquals(
    consolidarResultadoPreventiva({
      osConcluida: false,
      questionarioRecebido: true,
      respostas: [{ valor: "OK" }, { valor: "  NÃO   OK " }],
    }),
    "nao_ok",
  );
});

Deno.test("consolidarResultadoPreventiva — OS concluída e respostas completas sem reprovação resulta OK", () => {
  assertEquals(
    consolidarResultadoPreventiva({
      osConcluida: true,
      questionarioRecebido: true,
      respostas: [{ valor: "OK" }, { valor: "OK" }],
    }),
    "ok",
  );
});

Deno.test("consolidarResultadoPreventiva — resposta ausente ou questionário não recebido mantém pendente", () => {
  assertEquals(
    consolidarResultadoPreventiva({
      osConcluida: true,
      questionarioRecebido: true,
      respostas: [{ valor: "OK" }, { valor: "" }],
    }),
    "pendente",
  );
  assertEquals(
    consolidarResultadoPreventiva({
      osConcluida: true,
      questionarioRecebido: false,
      respostas: [{ valor: "OK" }],
    }),
    "pendente",
  );
});

Deno.test("consolidarResultadoPreventiva — texto livre parecido com Não OK não é inferido", () => {
  assertEquals(
    consolidarResultadoPreventiva({
      osConcluida: true,
      questionarioRecebido: true,
      respostas: [{ valor: "equipamento não está ok" }],
    }),
    "pendente",
  );
});
