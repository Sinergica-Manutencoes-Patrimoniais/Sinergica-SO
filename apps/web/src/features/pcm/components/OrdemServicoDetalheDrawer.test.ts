import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fonte = readFileSync(resolve(__dirname, "OrdemServicoDetalheDrawer.tsx"), "utf8");

describe("OrdemServicoDetalheDrawer — E01-S163", () => {
  it("mantém o chamado associado no mesmo drawer e escopa as leituras ao cliente", () => {
    expect(fonte).toContain("cliente360QueryKeys.detalheOs(clienteId, ordem.id)");
    expect(fonte).toContain("cliente360QueryKeys.dadosAberturaOs(clienteId)");
    expect(fonte).toContain("<ChamadoPainel");
    expect(fonte).toContain("chamadoId={ordem.chamadoId}");
    expect(fonte).toContain("onMutou={() => void onMutada()}");
  });

  it("preserva a consulta do histórico do chamado quando os dados de abertura falham", () => {
    expect(fonte).toContain("histórico do chamado continua acessível");
    expect(fonte).toContain("dadosOs={dadosAbertura.data ?? null}");
  });
});
