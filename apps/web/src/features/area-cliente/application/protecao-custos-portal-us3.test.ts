import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fonte = readFileSync(
  resolve(__dirname, "../infrastructure/supabase-portal-adapter.ts"),
  "utf8",
);

describe("E01-S184 US3 (AC-5/AC-6): decisão e arquivos do Portal passam por rota segura", () => {
  it("decide proposta e orçamento só pelas RPCs seguras (0232/0233), nunca pelas legadas", () => {
    expect(fonte).toContain('rpc("portal_decidir_proposta"');
    expect(fonte).toContain('rpc("portal_decidir_orcamento_seguro"');
    expect(fonte).not.toContain('rpc("fn_decidir_proposta"');
    expect(fonte).not.toContain('rpc("portal_decidir_orcamento",');
  });

  it("nunca referencia o bucket privado de comprovantes financeiros (0238/0311)", () => {
    expect(fonte).not.toContain("financeiro-comprovantes");
  });

  it("buckets abertos por urlAssinada no PortalShell são sempre literais, nunca o nome de um bucket privado", () => {
    const portalShell = readFileSync(resolve(__dirname, "../PortalShell.tsx"), "utf8");
    const chamadas = [...portalShell.matchAll(/abrirArquivo\("([^"]+)"/g)].map((m) => m[1]);
    expect(chamadas).toContain("inspecoes-midia");
    expect(chamadas.every((bucket) => bucket !== "financeiro-comprovantes")).toBe(true);
  });
});
