// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CampoIdentificador } from "./CampoIdentificador";

const mocks = vi.hoisted(() => ({ previa: vi.fn() }));

vi.mock("@sinergica/ui", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  ConfirmDialog: ({
    open,
    titulo,
    descricao,
    onConfirmar,
  }: { open: boolean; titulo: string; descricao: string; onConfirmar: () => Promise<void> }) =>
    open ? (
      <dialog open>
        <p>{titulo}</p>
        <p>{descricao}</p>
        <button type="button" onClick={() => onConfirmar()}>
          Confirmar
        </button>
      </dialog>
    ) : null,
}));

vi.mock("../application/ativos-cliente-queries", () => ({
  usePreviaIdentificador: mocks.previa,
}));

vi.mock("../infrastructure/supabase-identificador-ativo-adapter", () => ({
  supabaseIdentificadorAtivoAdapter: {},
}));

function Campo({
  modo = "editar",
  valorInicial = "GUA-ELE-BOM-01",
}: {
  modo?: "criar" | "editar";
  valorInicial?: string;
}) {
  const [valor, setValor] = useState(valorInicial);
  const [siglas, setSiglas] = useState<
    Array<{ nivel: "cliente" | "area" | "local" | "categoria"; id: string; sigla: string }>
  >([]);
  return (
    <CampoIdentificador
      modo={modo}
      input={null}
      valor={valor}
      onManualChange={(proximo) => setValor(proximo)}
      onAplicarRecomendacoes={(proximo) => setValor(proximo)}
      siglasInformadas={siglas}
      onSiglasChange={setSiglas}
    />
  );
}

describe("CampoIdentificador", () => {
  it("exige confirmação antes de liberar alteração", async () => {
    mocks.previa.mockReturnValue({ data: undefined });
    render(<Campo />);

    expect(screen.getByDisplayValue("GUA-ELE-BOM-01")).toHaveAttribute("readonly");
    await userEvent.click(screen.getByRole("button", { name: "Editar identificador" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Alterar identificador?");
    expect(screen.getByDisplayValue("GUA-ELE-BOM-01")).toHaveAttribute("readonly");

    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.getByDisplayValue("GUA-ELE-BOM-01")).not.toHaveAttribute("readonly");
  });

  it("exibe níveis sem sigla", () => {
    mocks.previa.mockReturnValue({
      data: { prefixo: null, nn: null, faltantes: [{ nivel: "area", id: "a1", nome: "Torre A" }] },
    });
    render(<Campo modo="criar" />);
    expect(screen.getByText("Siglas faltando")).toBeInTheDocument();
    expect(screen.getByText("Torre A")).toBeInTheDocument();
  });

  it("só preenche o identificador após aplicar as recomendações", async () => {
    mocks.previa.mockImplementation((_gateway, _input, siglas) => ({
      data:
        siglas.length === 0
          ? {
              prefixo: null,
              nn: null,
              faltantes: [{ nivel: "area", id: "a1", nome: "Torre A" }],
            }
          : { prefixo: "GUA-TOA-ELE-QUG", nn: "04", faltantes: [] },
    }));
    render(<Campo modo="criar" valorInicial="" />);

    expect(screen.getByDisplayValue("—")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Aplicar recomendações" }));

    expect(screen.getByDisplayValue("GUA-TOA-ELE-QUG-04")).toBeInTheDocument();
  });

  it("bloqueia a aplicação enquanto uma sugestão está inválida", async () => {
    mocks.previa.mockReturnValue({
      data: { prefixo: null, nn: null, faltantes: [{ nivel: "area", id: "a1", nome: "Torre A" }] },
    });
    render(<Campo modo="criar" valorInicial="" />);

    await userEvent.clear(screen.getByDisplayValue("TOA"));

    expect(screen.getByRole("button", { name: "Aplicar recomendações" })).toBeDisabled();
  });
});
