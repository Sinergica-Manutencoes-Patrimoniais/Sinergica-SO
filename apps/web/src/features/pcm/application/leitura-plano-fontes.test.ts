import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { lerCronogramaPlano } from "../domain/leitura-plano";
import { preverImportacaoPlano } from "./prever-importacao-plano";

// Opt-in: usa Python/openpyxl do ambiente de teste; apenas leitura das fontes versionadas.
const python = process.env.SSO_PYTHON_PLANILHAS;
const ler = (arquivo: string) => {
  if (!python) throw new Error("Runtime de planilhas não configurado.");
  const caminho = resolve(
    process.cwd(),
    "../../docs/planejamento/plano-manutencao/fontes",
    arquivo,
  );
  const codigo =
    "import json,openpyxl,datetime,sys; s=openpyxl.load_workbook(sys.argv[1],read_only=True,data_only=True)['CRONOGRAMA']; print(json.dumps([[v.isoformat()[:10] if isinstance(v,(datetime.datetime,datetime.date)) else v for v in r] for r in s.iter_rows(values_only=True)],ensure_ascii=False))";
  const texto = execFileSync(python, ["-c", codigo, caminho], {
    encoding: "utf8",
    timeout: 30_000,
    stdio: ["ignore", "pipe", "ignore"],
  });
  const abas = { CRONOGRAMA: JSON.parse(texto) as unknown[][] };
  return { abas, ...lerCronogramaPlano(abas) };
};

it.skipIf(!python)("lê os dois cronogramas reais sem deduzir execução ou cadastros", () => {
  const rimini = ler("plano-rimini-2026-final.xlsx");
  const home = ler("plano-i-home-2026.xlsx");
  expect(rimini.linhas).toHaveLength(59);
  expect(home.linhas).toHaveLength(53);
  expect(
    rimini.linhas.filter((linha) => linha.disciplina === "SPCI" && linha.duracao.valor === 0),
  ).toHaveLength(25);
  expect(rimini.linhas[0]?.semanas.find((semana) => semana.codigo === "S31")?.data).toBe(
    "2026-08-05",
  );
  expect(home.linhas[0]?.semanas.find((semana) => semana.codigo === "S01")?.data).toBe(
    "2026-08-05",
  );
  expect(home.linhas[0]?.duracao).toEqual({ valor: 30, unidade: "minutos" });
  expect(home.linhas[0]?.semanas.at(-1)?.data).toBe("2027-07-28");
  const previa = preverImportacaoPlano(rimini.abas, "rimini", "cliente", [], {});
  expect(previa).toHaveLength(59);
  expect(
    previa.filter((linha) => linha.conferencia.tempo?.estado === "tempo_a_validar"),
  ).toHaveLength(25);
  expect(previa.every((linha) => linha.conferencia.erros.includes("alvo_nao_encontrado"))).toBe(
    true,
  );
});
