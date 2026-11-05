// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("./RelacaoPlanoLegado", () => ({
  RelacaoPlanoLegado: ({ origemPreparada }: { origemPreparada: { tipo: string; id: string } }) => (
    <p>
      Relação {origemPreparada.tipo}: {origemPreparada.id}
    </p>
  ),
}));
import { IntegrarOrigemOcorrencia } from "./IntegrarOrigemOcorrencia";
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
it("abre a relação de modo explícito e com ocorrência identificada", () => {
  vi.stubEnv("VITE_SSO_RELACAO_PLANO_LEGADO_ENABLED", "true");
  vi.stubEnv("VITE_SSO_MATERIALIZAR_VISITA_LEGADO_ENABLED", "true");
  render(
    <IntegrarOrigemOcorrencia
      userId="u"
      clienteId="c"
      planoId="p"
      revision={1}
      preparadaId="ocorrencia"
      tipo="visita"
    />,
  );
  expect(screen.queryByText("Relação visita: ocorrencia")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Vincular Plano Preventivo existente" }));
  expect(screen.getByText("Relação visita: ocorrencia")).toBeInTheDocument();
});
