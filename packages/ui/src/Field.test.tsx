import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./Field";
import { Input } from "./Input";

describe("Field — E00-S15 AC-7", () => {
  it("liga label, ajuda e input pelo mesmo id/aria-describedby", () => {
    render(
      <Field label="E-mail" ajuda="Usado pra login">
        {(campo) => <Input {...campo} />}
      </Field>,
    );
    const input = screen.getByLabelText("E-mail");
    const ajudaId = input.getAttribute("aria-describedby");
    expect(ajudaId).toBeTruthy();
    expect(document.getElementById(ajudaId ?? "")).toHaveTextContent("Usado pra login");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("com erro: aria-invalid true, role alert, some a ajuda", () => {
    render(
      <Field label="E-mail" ajuda="Usado pra login" error="E-mail inválido">
        {(campo) => <Input {...campo} />}
      </Field>,
    );
    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("E-mail inválido");
    expect(screen.queryByText("Usado pra login")).not.toBeInTheDocument();
  });

  it("required marca visualmente e via atributo", () => {
    render(
      <Field label="Nome" required>
        {(campo) => <Input {...campo} />}
      </Field>,
    );
    expect(screen.getByLabelText(/Nome/)).toBeRequired();
  });
});
