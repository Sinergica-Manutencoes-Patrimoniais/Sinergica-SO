import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { tiposTarefaDescriptor } from "./tipos-tarefa.ts";

Deno.test("tiposTarefaDescriptor.toAuvo — mapeia requisitos reais de /tasktypes", () => {
  assertEquals(
    tiposTarefaDescriptor.toAuvo({
      id: "row-1",
      nome: "Manutenção preventiva",
      preenche_relato: true,
      exige_assinatura: true,
      fotos_minimas: 3,
      ativo: true,
    }),
    {
      description: "Manutenção preventiva",
      active: true,
      requirements: {
        fillReport: true,
        getSignature: true,
        minimumNumberOfPhotos: 3,
      },
    },
  );
});

Deno.test("tiposTarefaDescriptor.fromAuvo — mapeia retorno defensivamente", () => {
  assertEquals(
    tiposTarefaDescriptor.fromAuvo({
      id: 228714,
      description: "Corretiva",
      active: false,
      requirements: {
        fillReport: true,
        getSignature: false,
        minimumNumberOfPhotos: 2,
      },
    }),
    {
      nome: "Corretiva",
      ativo: false,
      preenche_relato: true,
      exige_assinatura: false,
      fotos_minimas: 2,
    },
  );
});
