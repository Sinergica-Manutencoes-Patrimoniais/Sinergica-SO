import { describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));
import { agruparOrdensPmoc } from "./supabase-pmoc-adapter";

describe("vínculos de OS à agenda PMOC", () => {
  it("preserva todas as OS de cada visita", () => {
    const resultado = agruparOrdensPmoc([
      { id: "os-a", pmoc_schedule_id: "visita-a" },
      { id: "os-b", pmoc_schedule_id: "visita-a" },
      { id: "os-c", pmoc_schedule_id: "visita-b" },
    ]);
    expect(resultado.get("visita-a")).toEqual(["os-a", "os-b"]);
    expect(resultado.get("visita-b")).toEqual(["os-c"]);
  });

  it("recusa a repetição da mesma OS, inclusive com diferença de caixa", () => {
    expect(() => agruparOrdensPmoc([
      { id: "os-a", pmoc_schedule_id: "visita-a" },
      { id: "OS-A", pmoc_schedule_id: "visita-b" },
    ])).toThrow("Vínculo de OS PMOC inválido.");
  });
});
