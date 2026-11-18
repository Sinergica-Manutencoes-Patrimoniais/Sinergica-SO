import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecursoNaoAtivado } from "./RecursoNaoAtivado";

describe("RecursoNaoAtivado — E00-S28 AC-4/AC-5/AC-6", () => {
  it("nunca renderiza null — sempre há conteúdo visível", () => {
    const { container } = render(
      <RecursoNaoAtivado recurso="Criar OS neste Chamado" podeAdministrar={false} />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("administrador vê o nome do recurso e o que falta", () => {
    render(
      <RecursoNaoAtivado
        recurso="Criar OS neste Chamado"
        podeAdministrar
        faltando={["VITE_SSO_CRIAR_OS_CHAMADO_ENABLED", "pcm.chamado_os_gate"]}
      />,
    );
    expect(screen.getByText("Criar OS neste Chamado")).toBeInTheDocument();
    expect(screen.getByText("VITE_SSO_CRIAR_OS_CHAMADO_ENABLED")).toBeInTheDocument();
    expect(screen.getByText("pcm.chamado_os_gate")).toBeInTheDocument();
  });

  it("não-administrador não vê nome de flag, gate ou recurso técnico (AC-6)", () => {
    render(
      <RecursoNaoAtivado
        recurso="Criar OS neste Chamado"
        podeAdministrar={false}
        faltando={["VITE_SSO_CRIAR_OS_CHAMADO_ENABLED", "pcm.chamado_os_gate"]}
      />,
    );
    expect(screen.queryByText("Criar OS neste Chamado")).not.toBeInTheDocument();
    expect(screen.queryByText("VITE_SSO_CRIAR_OS_CHAMADO_ENABLED")).not.toBeInTheDocument();
    expect(screen.queryByText("pcm.chamado_os_gate")).not.toBeInTheDocument();
    expect(screen.getByText(/ainda não está disponível/i)).toBeInTheDocument();
  });

  it("administrador sem lista de faltantes não quebra", () => {
    render(<RecursoNaoAtivado recurso="X" podeAdministrar />);
    expect(screen.getByText("X")).toBeInTheDocument();
  });

  it("exibe link de runbook só para administrador", () => {
    render(<RecursoNaoAtivado recurso="X" podeAdministrar runbook="https://runbooks.interno/x" />);
    expect(screen.getByRole("link", { name: /procedimento de ativação/i })).toHaveAttribute(
      "href",
      "https://runbooks.interno/x",
    );
  });
});
