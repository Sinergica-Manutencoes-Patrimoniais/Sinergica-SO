import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { contratoPreventivoCompleto } from "./index.ts";

Deno.test("contratoPreventivoCompleto — exige evidência válida para Sistema e Equipamento", () => {
  assertEquals(contratoPreventivoCompleto({}), false);
  assertEquals(
    contratoPreventivoCompleto({
      sistema: { tecnico: true, data: true, alvo: true, questionario: true },
    }),
    false,
  );
  assertEquals(
    contratoPreventivoCompleto({
      sistema: { tecnico: true, data: true, alvo: true, questionario: true },
      equipamento: { tecnico: true, data: true, alvo: true, questionario: true },
    }),
    true,
  );
});
