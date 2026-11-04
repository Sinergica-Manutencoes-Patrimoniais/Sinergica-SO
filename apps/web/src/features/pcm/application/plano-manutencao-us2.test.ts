import { expect, it, vi } from "vitest";
import { aprovarPlano, transicionarRevisao } from "./plano-manutencao";

const comando = {
  requestId: "16500000-0000-4000-8000-000000000101",
  planoId: "16500000-0000-4000-8000-000000000011",
  expectedRevision: 3,
};

it("rejeita vigência inexistente sem enviar aprovação", async () => {
  const gateway = { aprovarPlano: vi.fn() };
  await expect(aprovarPlano(gateway, { ...comando, vigencia: "2026-02-30" })).rejects.toThrow();
  expect(gateway.aprovarPlano).not.toHaveBeenCalled();
});

it("rejeita revisão inválida antes da transição", async () => {
  const gateway = { transicionarRevisao: vi.fn() };
  await expect(
    transicionarRevisao(gateway, { ...comando, expectedRevision: 0, acao: "submeter" }),
  ).rejects.toThrow();
  expect(gateway.transicionarRevisao).not.toHaveBeenCalled();
});
