// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressoChamadoCard } from "./ProgressoChamadoCard";

describe("progresso no card gerencial", () => {
  it("mostra contagem completa e etapas mistas sem afirmar conclusão", () => {
    render(<ProgressoChamadoCard resumo={{ total: 2, finalizadas: 1, etapasMistas: true }} />);
    expect(screen.getByText("1 de 2 OS finalizadas · Em andamento")).toBeTruthy();
  });
  it("não apresenta informação quando resumo não está disponível", () => {
    const { container } = render(<ProgressoChamadoCard resumo={null} />);
    expect(container.textContent).toBe("");
  });
});
