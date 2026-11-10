import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { projetarVencimentosPorCalendario } from "./calendario-contratual";

// Opt-in: banco Supabase local específico, sem gravações nem serviços externos.
describe.skipIf(process.env.SSO_TESTE_BANCO_LOCAL !== "1")("calendário da interface e do banco", () => {
  it("converge em ciclos diários, semanais, mensais e anuais a partir da âncora", () => {
    const casos = [
      { dataBase: "2024-01-31", intervalo: 1, unidade: "meses" },
      { dataBase: "2024-02-29", intervalo: 1, unidade: "anos" },
      { dataBase: "2026-10-01", intervalo: 2, unidade: "semanas" },
      { dataBase: "2026-10-01", intervalo: 3, unidade: "dias" },
      { dataBase: "2096-02-29", intervalo: 1, unidade: "anos" },
      { dataBase: "2025-08-31", intervalo: 3, unidade: "meses" },
    ] as const;
    for (const caso of casos) {
      const sql = `select coalesce(json_agg(json_build_object('ciclo', n, 'vencimento', pcm.sso_vencimento_ciclo_calendario('${caso.dataBase}', ${caso.intervalo}, '${caso.unidade}', n)::text) order by n), '[]'::json) from generate_series(0, 12) n`;
      const resultado = execFileSync("rtk", ["proxy", "docker", "exec", "-i", "supabase_db_Sinergica-SO", "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres", "-c", sql], { encoding: "utf8" });
      const servidor = JSON.parse(resultado) as { ciclo: number; vencimento: string }[];
      const interfaceResultado = projetarVencimentosPorCalendario({
        ...caso,
        inicio: caso.dataBase,
        fim: servidor[12]!.vencimento,
        feriados: [],
      }).map(({ ciclo, vencimento }) => ({ ciclo, vencimento }));
      expect(interfaceResultado, JSON.stringify(caso)).toEqual(servidor);
    }
  });
});
