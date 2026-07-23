import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseOfx } from "./ofx";

const __dirname = dirname(fileURLToPath(import.meta.url));

function lerFixture(nome: string): string {
  return readFileSync(join(__dirname, "__fixtures__", nome), "utf-8");
}

describe("parseOfx", () => {
  it("parseia OFX 1.x (SGML, tags sem fechamento)", () => {
    const resultado = parseOfx(lerFixture("exemplo-1x.ofx"));
    expect(resultado.bankId).toBe("341");
    expect(resultado.acctId).toBe("12345-6");
    expect(resultado.transacoes).toHaveLength(3);

    const [debito, credito, tarifa] = resultado.transacoes;
    expect(debito).toMatchObject({
      fitid: "SGML0001",
      data: "2026-07-02",
      valorCentavos: -15000,
      tipoOfx: "DEBIT",
    });
    expect(debito?.memo).toContain("FORNECEDOR");
    expect(credito).toMatchObject({ fitid: "SGML0002", data: "2026-07-03", valorCentavos: 150000 });
    expect(tarifa).toMatchObject({ fitid: "SGML0003", valorCentavos: -4590 });
  });

  it("parseia OFX 2.x (XML bem-formado)", () => {
    const resultado = parseOfx(lerFixture("exemplo-2x.ofx"));
    expect(resultado.bankId).toBe("001");
    expect(resultado.acctId).toBe("98765-4");
    expect(resultado.transacoes).toHaveLength(2);
    expect(resultado.transacoes[0]).toMatchObject({
      fitid: "XML0001",
      data: "2026-07-06",
      valorCentavos: 220000,
      tipoOfx: "CREDIT",
    });
    expect(resultado.transacoes[1]).toMatchObject({ fitid: "XML0002", valorCentavos: -32050 });
  });

  it("rejeita arquivo sem transação alguma", () => {
    expect(() => parseOfx("<OFX><SIGNONMSGSRSV1></SIGNONMSGSRSV1></OFX>")).toThrow(
      "nenhuma transação",
    );
  });

  it("rejeita arquivo vazio", () => {
    expect(() => parseOfx("")).toThrow("Arquivo OFX inválido");
  });

  it("pula transação sem FITID/valor sem quebrar o restante do arquivo", () => {
    const texto = `
      <STMTTRN>
      <TRNTYPE>DEBIT
      <DTPOSTED>20260701120000
      <MEMO>SEM VALOR NEM FITID
      </STMTTRN>
      <STMTTRN>
      <TRNTYPE>CREDIT
      <DTPOSTED>20260702120000
      <TRNAMT>100.00
      <FITID>VALIDO001
      <MEMO>TRANSACAO VALIDA
      </STMTTRN>
    `;
    const resultado = parseOfx(texto);
    expect(resultado.transacoes).toHaveLength(1);
    expect(resultado.transacoes[0]?.fitid).toBe("VALIDO001");
  });

  it("interpreta valor negativo e positivo corretamente (centavos, nunca float)", () => {
    const texto = `
      <STMTTRN>
      <TRNTYPE>DEBIT
      <DTPOSTED>20260701120000
      <TRNAMT>-0.01
      <FITID>CENTAVO001
      </STMTTRN>
    `;
    const resultado = parseOfx(texto);
    expect(resultado.transacoes[0]?.valorCentavos).toBe(-1);
  });
});
